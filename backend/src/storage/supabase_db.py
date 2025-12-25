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
from typing import Optional, Literal
from datetime import datetime

# Supabase configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

# Check if Supabase is configured
USE_SUPABASE_DB = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)

# Valid file types
FileType = Literal['uploaded', 'generated', 'chart', 'code']

# Async Supabase client singleton
_supabase_client = None


async def get_supabase_client():
    """Get async Supabase client instance."""
    global _supabase_client
    if not USE_SUPABASE_DB:
        return None
    if _supabase_client is None:
        from supabase import acreate_client
        _supabase_client = await acreate_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
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
        file_data = {
            "id": file_id,
            "user_id": user_id,
            "filename": filename,
            "storage_path": storage_path,
            "file_size": file_size,
            "content_type": content_type,
            "file_type": file_type,
        }

        result = await supabase.table("files").insert(file_data).execute()

        if result.data and len(result.data) > 0:
            file_record = result.data[0]
            print(f"[SupabaseDB] Saved file record: {filename} (type={file_type})")

            # If thread_id provided, create association
            if thread_id:
                await create_thread_file_link(thread_id, file_id)

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


async def delete_file_record(file_id: str, user_id: str) -> bool:
    """
    Delete a file record (also deletes thread_files associations via CASCADE).

    Args:
        file_id: The file's UUID
        user_id: The user's ID (for verification)

    Returns:
        True if successful, False otherwise
    """
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

        if result.data:
            print(f"[SupabaseDB] Deleted file record: {file_id}")
            return True

        return False

    except Exception as e:
        print(f"[SupabaseDB] Error deleting file record: {e}")
        return False


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
