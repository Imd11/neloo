"""
Supabase Database Operations Module

Provides functions to interact with Supabase PostgreSQL database
for the files and thread_files tables.

This module handles:
- Saving file records to the files table
- Creating thread_files associations
- Querying files by type and user
- Listing files for a thread
"""

import os
import uuid
import os.path
from typing import Optional, Literal
from datetime import datetime, timedelta
import asyncio

# Supabase configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

# Check if Supabase is configured
USE_SUPABASE_DB = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)

# Valid file types
FileType = Literal['uploaded', 'generated', 'chart', 'code']

# Async Supabase client singleton
_supabase_client = None
_supabase_client_loop: asyncio.AbstractEventLoop | None = None


async def get_supabase_client():
    """Get async Supabase client instance."""
    global _supabase_client
    global _supabase_client_loop
    if not USE_SUPABASE_DB:
        return None
    # NOTE: the async client is bound to the event loop it was created in.
    # This codebase sometimes performs async DB writes from a temporary event loop
    # (e.g. sync fallbacks in file/image storage). If we cache a client created
    # in that temporary loop, subsequent requests in the main server loop will
    # fail with "Event loop is closed". So we recreate the client whenever the
    # current loop differs or the original loop is closed.
    loop = asyncio.get_running_loop()
    if (
        _supabase_client is None
        or _supabase_client_loop is None
        or _supabase_client_loop.is_closed()
        or _supabase_client_loop is not loop
    ):
        # Best-effort close of an existing client/session if supported.
        try:
            close_fn = getattr(_supabase_client, "aclose", None) or getattr(_supabase_client, "close", None)
            if callable(close_fn):
                maybe_awaitable = close_fn()
                if asyncio.iscoroutine(maybe_awaitable):
                    await maybe_awaitable
        except Exception:
            pass
        from supabase import acreate_client
        _supabase_client = await acreate_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        _supabase_client_loop = loop
    return _supabase_client


async def save_file_record(
    user_id: str,
    filename: str,
    storage_path: str,
    file_size: int,
    content_type: str,
    file_type: FileType,
    thread_id: Optional[str] = None,
) -> Optional[dict]:
    """
    Save a file record to the files table.

    Args:
        user_id: The user's ID (from Supabase Auth)
        filename: Original filename
        storage_path: Path in Supabase Storage
        file_size: File size in bytes
        content_type: MIME type
        file_type: One of 'uploaded', 'generated', 'chart', 'code'
        thread_id: Optional thread ID to associate the file with

    Returns:
        The created file record, or None if failed
    """
    if not USE_SUPABASE_DB:
        print(f"[SupabaseDB] Skipping save_file_record (not configured)")
        return None

    try:
        supabase = await get_supabase_client()
        if not supabase:
            return None

        file_id = str(uuid.uuid4())

        # Insert into files table
        # - filename: stored filename (basename of storage path)
        # - original_filename: user-facing name (parameter `filename`)
        stored_filename = os.path.basename(storage_path) or filename

        bucket = None
        if file_type == "uploaded":
            bucket = "data-analyst-files"
        elif file_type in ("generated", "code"):
            bucket = "data-analyst-generated"
        elif file_type == "chart":
            bucket = "data-analyst-images"

        file_data = {
            "id": file_id,
            "user_id": user_id,
            "filename": stored_filename,
            "original_filename": filename,
            "storage_path": storage_path,
            "file_size": file_size,
            "content_type": content_type,
            "file_type": file_type,
            "bucket": bucket,
            "download_url": f"/api/files/{file_id}/download",
        }

        result = await supabase.table("files").insert(file_data).execute()

        if result.data and len(result.data) > 0:
            file_record = result.data[0]
            print(f"[SupabaseDB] Saved file record: {filename} (type={file_type})")

            # If thread_id provided (this is langgraph_thread_id), create association
            if thread_id:
                # Get the thread record UUID from langgraph_thread_id
                # Note: thread_id parameter here is actually the langgraph_thread_id
                thread_record = await get_thread_by_langgraph_id(thread_id)
                if thread_record:
                    # Use the threads table UUID for the association
                    await create_thread_file_link(thread_record["id"], file_id)
                else:
                    print(f"[SupabaseDB] Warning: Thread not found for langgraph_id {thread_id[:8]}... File saved but not linked to thread.")

            return file_record

        return None

    except Exception as e:
        print(f"[SupabaseDB] Error saving file record: {e}")
        return None


async def create_thread_file_link(thread_id: str, file_id: str) -> bool:
    """
    Create a thread_files association.

    Args:
        thread_id: The thread's UUID
        file_id: The file's UUID

    Returns:
        True if successful, False otherwise
    """
    if not USE_SUPABASE_DB:
        return False

    try:
        supabase = await get_supabase_client()
        if not supabase:
            return False

        link_data = {
            "id": str(uuid.uuid4()),
            "thread_id": thread_id,
            "file_id": file_id,
        }

        result = await supabase.table("thread_files").insert(link_data).execute()

        if result.data and len(result.data) > 0:
            print(f"[SupabaseDB] Created thread_file link: thread={thread_id[:8]}... -> file={file_id[:8]}...")
            return True

        return False

    except Exception as e:
        # Might fail on duplicate, which is OK
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            print(f"[SupabaseDB] Thread-file link already exists")
            return True
        print(f"[SupabaseDB] Error creating thread_file link: {e}")
        return False


async def get_files_by_type(
    user_id: str,
    file_type: Optional[FileType] = None,
    thread_id: Optional[str] = None,
    limit: int = 100,
) -> list[dict]:
    """
    Get files for a user, optionally filtered by type and/or thread.

    Args:
        user_id: The user's ID
        file_type: Optional filter by file type
        thread_id: Optional filter by thread
        limit: Maximum number of results

    Returns:
        List of file records
    """
    if not USE_SUPABASE_DB:
        return []

    try:
        supabase = await get_supabase_client()
        if not supabase:
            return []

        query = supabase.table("files").select("*").eq("user_id", user_id)

        if file_type:
            query = query.eq("file_type", file_type)

        query = query.order("created_at", desc=True).limit(limit)

        result = await query.execute()

        files = result.data or []

        # If thread_id specified, filter by thread association
        if thread_id and files:
            # Get file IDs associated with this thread
            thread_files_result = await supabase.table("thread_files")\
                .select("file_id")\
                .eq("thread_id", thread_id)\
                .execute()

            associated_file_ids = {tf["file_id"] for tf in (thread_files_result.data or [])}
            files = [f for f in files if f["id"] in associated_file_ids]

        return files

    except Exception as e:
        print(f"[SupabaseDB] Error getting files: {e}")
        return []


async def get_user_files(
    user_id: str,
    file_types: Optional[list[FileType]] = None,
    limit: int = 200,
) -> list[dict]:
    """Get all files for a user, optionally filtered by file_type list."""
    if not USE_SUPABASE_DB:
        return []
    try:
        supabase = await get_supabase_client()
        if not supabase:
            return []
        query = supabase.table("files").select("*").eq("user_id", user_id)
        if file_types:
            query = query.in_("file_type", file_types)
        query = query.order("created_at", desc=True).limit(limit)
        result = await query.execute()
        return result.data or []
    except Exception as e:
        print(f"[SupabaseDB] Error getting user files: {e}")
        return []


async def get_thread_files(thread_id: str) -> list[dict]:
    """
    Get all files associated with a thread.

    Args:
        thread_id: The thread's UUID

    Returns:
        List of file records
    """
    if not USE_SUPABASE_DB:
        return []

    try:
        supabase = await get_supabase_client()
        if not supabase:
            return []

        # Join thread_files with files
        result = await supabase.table("thread_files")\
            .select("file_id, files(*)")\
            .eq("thread_id", thread_id)\
            .execute()

        if result.data:
            # Extract the file records from the join result
            files = [item["files"] for item in result.data if item.get("files")]
            return files

        return []

    except Exception as e:
        print(f"[SupabaseDB] Error getting thread files: {e}")
        return []


async def count_file_thread_links(file_id: str, user_id: str) -> int:
    """Count how many threads (owned by user) reference a file."""
    if not USE_SUPABASE_DB:
        return 0
    try:
        supabase = await get_supabase_client()
        if not supabase:
            return 0
        # Count thread_files where thread belongs to user.
        result = await supabase.table("thread_files")\
            .select("id, threads!inner(user_id)", count="exact")\
            .eq("file_id", file_id)\
            .eq("threads.user_id", user_id)\
            .execute()
        return int(getattr(result, "count", None) or 0)
    except Exception as e:
        print(f"[SupabaseDB] Error counting file links: {e}")
        return 0


async def delete_file_record(file_id: str, user_id: str) -> bool:
    """Delete a file record by ID (verifying ownership)."""
    if not USE_SUPABASE_DB:
        return False
    try:
        supabase = await get_supabase_client()
        if not supabase:
            return False
        result = await supabase.table("files")\
            .delete()\
            .eq("id", file_id)\
            .eq("user_id", user_id)\
            .execute()
        return bool(result.data)
    except Exception as e:
        print(f"[SupabaseDB] Error deleting file record: {e}")
        return False


async def delete_thread_file_link(thread_db_id: str, file_id: str) -> bool:
    """Delete thread_files association."""
    if not USE_SUPABASE_DB:
        return False
    try:
        supabase = await get_supabase_client()
        if not supabase:
            return False
        result = await supabase.table("thread_files")\
            .delete()\
            .eq("thread_id", thread_db_id)\
            .eq("file_id", file_id)\
            .execute()
        return True if result.data is not None else True
    except Exception as e:
        print(f"[SupabaseDB] Error deleting thread_file link: {e}")
        return False


async def get_file_by_id(file_id: str) -> Optional[dict]:
    """Fetch a file record by ID."""
    if not USE_SUPABASE_DB:
        return None
    try:
        supabase = await get_supabase_client()
        if not supabase:
            return None
        result = await supabase.table("files").select("*").eq("id", file_id).limit(1).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]
        return None
    except Exception as e:
        print(f"[SupabaseDB] Error getting file by id: {e}")
        return None


async def create_thread(
    user_id: str,
    langgraph_thread_id: str,
    title: str = "New Task",
) -> Optional[dict]:
    """
    Create a thread record in the threads table.

    Args:
        user_id: The user's ID (from Supabase Auth)
        langgraph_thread_id: The LangGraph thread ID (UUID from frontend)
        title: Optional thread title

    Returns:
        The created thread record, or None if failed
    """
    if not USE_SUPABASE_DB:
        print(f"[SupabaseDB] Skipping create_thread (not configured)")
        return None

    try:
        supabase = await get_supabase_client()
        if not supabase:
            return None

        thread_id = str(uuid.uuid4())

        thread_data = {
            "id": thread_id,
            "user_id": user_id,
            "title": title,
            "langgraph_thread_id": langgraph_thread_id,
        }

        result = await supabase.table("threads").insert(thread_data).execute()

        if result.data and len(result.data) > 0:
            thread_record = result.data[0]
            print(f"[SupabaseDB] Created thread: {langgraph_thread_id[:8]}... (title={title})")
            return thread_record

        return None

    except Exception as e:
        # Check if it's a duplicate key error
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            print(f"[SupabaseDB] Thread already exists: {langgraph_thread_id[:8]}...")
            # Try to fetch the existing thread
            try:
                result = await supabase.table("threads")\
                    .select("*")\
                    .eq("langgraph_thread_id", langgraph_thread_id)\
                    .execute()
                if result.data and len(result.data) > 0:
                    return result.data[0]
            except Exception:
                pass
        print(f"[SupabaseDB] Error creating thread: {e}")
        return None


async def get_user_threads(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """
    Get threads for a user.

    Args:
        user_id: The user's ID
        limit: Maximum number of results
        offset: Offset for pagination

    Returns:
        List of thread records
    """
    if not USE_SUPABASE_DB:
        return []

    try:
        supabase = await get_supabase_client()
        if not supabase:
            return []

        result = await supabase.table("threads")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("updated_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()

        return result.data or []

    except Exception as e:
        print(f"[SupabaseDB] Error getting user threads: {e}")
        return []


async def get_thread_by_langgraph_id(
    langgraph_thread_id: str,
) -> Optional[dict]:
    """
    Get a thread record by LangGraph thread ID.

    Args:
        langgraph_thread_id: The LangGraph thread ID

    Returns:
        Thread record or None if not found
    """
    if not USE_SUPABASE_DB:
        return None

    try:
        supabase = await get_supabase_client()
        if not supabase:
            return None

        result = await supabase.table("threads")\
            .select("*")\
            .eq("langgraph_thread_id", langgraph_thread_id)\
            .execute()

        if result.data and len(result.data) > 0:
            return result.data[0]

        return None

    except Exception as e:
        print(f"[SupabaseDB] Error getting thread by langgraph_id: {e}")
        return None


async def update_thread_title(
    langgraph_thread_id: str,
    title: str,
) -> bool:
    """
    Update a thread's title.

    Args:
        langgraph_thread_id: The LangGraph thread ID
        title: New title

    Returns:
        True if successful, False otherwise
    """
    if not USE_SUPABASE_DB:
        return False

    try:
        supabase = await get_supabase_client()
        if not supabase:
            return False

        result = await supabase.table("threads")\
            .update({"title": title, "updated_at": datetime.now().isoformat()})\
            .eq("langgraph_thread_id", langgraph_thread_id)\
            .execute()

        if result.data:
            print(f"[SupabaseDB] Updated thread title: {langgraph_thread_id[:8]}... -> {title}")
            return True

        return False

    except Exception as e:
        print(f"[SupabaseDB] Error updating thread title: {e}")
        return False


# =============================================================================
# Upload Session Management (Staging Area Pattern)
# =============================================================================

async def create_upload_session(
    user_id: str,
    file_id: str,
    filename: str,
    expected_size: int,
    storage_path: str,
    ttl_seconds: int = 3600,
) -> Optional[dict]:
    """
    Create an upload session record in the database.

    This tracks pending uploads before they're committed to a thread.

    Args:
        user_id: The user's ID (from JWT)
        file_id: Unique file identifier
        filename: Original filename
        expected_size: Expected file size in bytes
        storage_path: Path where file will be stored
        ttl_seconds: Time to live for the session

    Returns:
        The created session record, or None if failed
    """
    if not USE_SUPABASE_DB:
        print(f"[SupabaseDB] Skipping create_upload_session (not configured)")
        return None

    try:
        supabase = await get_supabase_client()
        if not supabase:
            return None

        expires_at = datetime.now() + timedelta(seconds=ttl_seconds)

        session_data = {
            "id": file_id,
            "user_id": user_id,
            "filename": filename,
            "expected_size": expected_size,
            "storage_path": storage_path,
            "status": "pending",  # pending -> uploaded -> committed
            "committed": False,
            "expires_at": expires_at.isoformat(),
        }

        result = await supabase.table("upload_sessions").insert(session_data).execute()

        if result.data and len(result.data) > 0:
            print(f"[SupabaseDB] Created upload session: {file_id[:8]}... ({filename})")
            return result.data[0]

        return None

    except Exception as e:
        print(f"[SupabaseDB] Error creating upload session: {e}")
        return None


async def get_upload_session(file_id: str, user_id: str) -> Optional[dict]:
    """
    Get an upload session by file ID and user ID.

    Args:
        file_id: The file/session ID
        user_id: The user's ID (for ownership verification)

    Returns:
        Session record or None if not found/expired
    """
    if not USE_SUPABASE_DB:
        return None

    try:
        supabase = await get_supabase_client()
        if not supabase:
            return None

        result = await supabase.table("upload_sessions")\
            .select("*")\
            .eq("id", file_id)\
            .eq("user_id", user_id)\
            .execute()

        if result.data and len(result.data) > 0:
            session = result.data[0]
            # Check if expired
            expires_at = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
            if expires_at.replace(tzinfo=None) < datetime.now():
                print(f"[SupabaseDB] Upload session expired: {file_id[:8]}...")
                return None
            return session

        return None

    except Exception as e:
        print(f"[SupabaseDB] Error getting upload session: {e}")
        return None


async def update_upload_session_status(
    file_id: str,
    status: str,
    actual_size: Optional[int] = None,
) -> bool:
    """
    Update an upload session's status.

    Args:
        file_id: The file/session ID
        status: New status ('pending', 'uploaded', 'committed', 'error')
        actual_size: Actual file size after upload (optional)

    Returns:
        True if successful, False otherwise
    """
    if not USE_SUPABASE_DB:
        return False

    try:
        supabase = await get_supabase_client()
        if not supabase:
            return False

        update_data = {"status": status, "updated_at": datetime.now().isoformat()}
        if actual_size is not None:
            update_data["actual_size"] = actual_size

        result = await supabase.table("upload_sessions")\
            .update(update_data)\
            .eq("id", file_id)\
            .execute()

        if result.data:
            print(f"[SupabaseDB] Updated upload session status: {file_id[:8]}... -> {status}")
            return True

        return False

    except Exception as e:
        print(f"[SupabaseDB] Error updating upload session: {e}")
        return False


async def commit_upload_session(file_id: str, thread_id: str) -> bool:
    """
    Mark an upload session as committed and associate with thread.

    Args:
        file_id: The file/session ID
        thread_id: The LangGraph thread ID

    Returns:
        True if successful, False otherwise
    """
    if not USE_SUPABASE_DB:
        return False

    try:
        supabase = await get_supabase_client()
        if not supabase:
            return False

        update_data = {
            "committed": True,
            "thread_id": thread_id,
            "status": "committed",
            "updated_at": datetime.now().isoformat(),
        }

        result = await supabase.table("upload_sessions")\
            .update(update_data)\
            .eq("id", file_id)\
            .execute()

        if result.data:
            print(f"[SupabaseDB] Committed upload: {file_id[:8]}... to thread {thread_id[:8]}...")
            return True

        return False

    except Exception as e:
        print(f"[SupabaseDB] Error committing upload session: {e}")
        return False


async def get_user_pending_uploads(user_id: str) -> list[dict]:
    """
    Get all pending (non-expired, non-committed) uploads for a user.

    Args:
        user_id: The user's ID

    Returns:
        List of pending upload sessions
    """
    if not USE_SUPABASE_DB:
        return []

    try:
        supabase = await get_supabase_client()
        if not supabase:
            return []

        now = datetime.now().isoformat()

        result = await supabase.table("upload_sessions")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("committed", False)\
            .gt("expires_at", now)\
            .order("created_at", desc=True)\
            .execute()

        return result.data or []

    except Exception as e:
        print(f"[SupabaseDB] Error getting pending uploads: {e}")
        return []


async def cleanup_expired_uploads() -> int:
    """
    Delete expired and uncommitted upload sessions.

    Returns:
        Number of sessions deleted
    """
    if not USE_SUPABASE_DB:
        return 0

    try:
        supabase = await get_supabase_client()
        if not supabase:
            return 0

        now = datetime.now().isoformat()

        # Delete expired sessions that were never committed
        result = await supabase.table("upload_sessions")\
            .delete()\
            .eq("committed", False)\
            .lt("expires_at", now)\
            .execute()

        deleted_count = len(result.data) if result.data else 0

        if deleted_count > 0:
            print(f"[SupabaseDB] Cleaned up {deleted_count} expired upload sessions")

        return deleted_count

    except Exception as e:
        print(f"[SupabaseDB] Error cleaning up expired uploads: {e}")
        return 0


# =============================================================================
# Synchronous wrappers for use in non-async contexts
def save_file_record_sync(
    user_id: str,
    filename: str,
    storage_path: str,
    file_size: int,
    content_type: str,
    file_type: FileType,
    thread_id: Optional[str] = None,
) -> Optional[dict]:
    """
    Synchronous wrapper for save_file_record.

    Note: This creates a new event loop if needed. Use async version when possible.
    """
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # We're in an async context, need to use create_task or similar
            # For now, just log and skip
            print(f"[SupabaseDB] Cannot run sync wrapper in async context")
            return None
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    try:
        return loop.run_until_complete(save_file_record(
            user_id=user_id,
            filename=filename,
            storage_path=storage_path,
            file_size=file_size,
            content_type=content_type,
            file_type=file_type,
            thread_id=thread_id,
        ))
    except Exception as e:
        print(f"[SupabaseDB] Sync wrapper error: {e}")
        return None


def create_thread_file_link_sync(thread_id: str, file_id: str) -> bool:
    """Synchronous wrapper for create_thread_file_link."""
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            print(f"[SupabaseDB] Cannot run sync wrapper in async context")
            return False
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    try:
        return loop.run_until_complete(create_thread_file_link(thread_id, file_id))
    except Exception as e:
        print(f"[SupabaseDB] Sync wrapper error: {e}")
        return False
