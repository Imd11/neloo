"""
File Synchronization Module

This module handles synchronizing files from storage to sandbox environments
(Local subprocess or E2B).

Storage modes:
- Local Storage: When Supabase is not configured, files are stored locally
- Supabase Storage: When SUPABASE_URL and SUPABASE_SERVICE_KEY are set

Functions:
- get_file_content: Get file content from storage (local or Supabase)
- sync_file_to_local: Sync file to local sandbox path
- sync_file_to_e2b: Sync file to E2B sandbox
- get_local_data_dir: Get local data directory path
"""

import os
import hashlib
import shutil
import tempfile
from pathlib import Path
from typing import Optional

# =============================================================================
# Configuration
# =============================================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
BUCKET_NAME = "data-analyst-files"

# Check if we're using local storage mode (same logic as webapp.py)
USE_LOCAL_STORAGE = not (SUPABASE_URL and SUPABASE_SERVICE_KEY)

# Local storage directory (used when Supabase is not configured)
# This must match the LOCAL_STORAGE_DIR in webapp.py
# Using the same path as get_local_data_dir() so uploaded files are directly available
LOCAL_STORAGE_DIR = Path(tempfile.gettempdir()) / "data-analyst-sandbox" / "data"

# Default sandbox data directory (used in E2B and as virtual path in local mode)
SANDBOX_DATA_DIR = "/home/user/data"

# Local data directory for sandbox execution (persistent across executions)
def get_local_data_dir(user_id: str = "default") -> Path:
    """
    Get the local data directory for storing synced files in sandbox.

    This directory persists across multiple code executions in local sandbox mode.
    Files are stored here and referenced via SANDBOX_DATA_DIR paths in user code.
    """
    safe_user_id = hashlib.sha256(user_id.encode("utf-8")).hexdigest()
    data_dir = LOCAL_STORAGE_DIR / safe_user_id
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def _split_local_storage_path(storage_path: str) -> tuple[str, str]:
    if "/" in storage_path:
        user_id, filename = storage_path.split("/", 1)
        return user_id, filename
    return "default", storage_path


# =============================================================================
# Supabase Client (only used when Supabase is configured)
# =============================================================================

def get_supabase_client():
    """Get Supabase client instance (only when Supabase is configured)."""
    if USE_LOCAL_STORAGE:
        return None
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# =============================================================================
# File Operations
# =============================================================================

def get_file_content(storage_path: str) -> Optional[bytes]:
    """
    Get file content from storage (local or Supabase).

    Args:
        storage_path: Path in storage (e.g., "user_id/filename.csv" for Supabase,
                      or just "filename.csv" for local mode)

    Returns:
        File content as bytes, or None if failed
    """
    print(f"[FileSync] get_file_content called with storage_path={storage_path}")

    if USE_LOCAL_STORAGE:
        # Local storage mode - read only from the owning guest's directory.
        user_id, filename = _split_local_storage_path(storage_path)
        local_file_path = get_local_data_dir(user_id) / filename
        print(f"[FileSync] Local mode: looking for file at {local_file_path}")
        try:
            if local_file_path.exists():
                with open(local_file_path, "rb") as f:
                    content = f.read()
                    print(f"[FileSync] Successfully read {len(content)} bytes from {local_file_path}")
                    return content
            else:
                print(f"[FileSync] File not found: {local_file_path}")
                return None
        except Exception as e:
            print(f"[FileSync] Failed to read local file: {e}")
            import traceback
            print(f"[FileSync] Traceback: {traceback.format_exc()}")
            return None
    else:
        # Supabase storage mode
        print(f"[FileSync] Supabase mode: downloading {storage_path} from bucket {BUCKET_NAME}")
        client = get_supabase_client()
        if not client:
            print(f"[FileSync] Failed to get Supabase client")
            return None

        try:
            response = client.storage.from_(BUCKET_NAME).download(storage_path)
            print(f"[FileSync] Successfully downloaded {len(response)} bytes from Supabase")
            return response
        except Exception as e:
            print(f"[FileSync] Failed to download from Supabase: {e}")
            import traceback
            print(f"[FileSync] Traceback: {traceback.format_exc()}")
            return None


def sync_file_to_local(
    storage_path: str,
    sandbox_path: Optional[str] = None,
    local_base_dir: Optional[str] = None,
) -> Optional[str]:
    """
    Sync file from storage to local filesystem for local sandbox execution.

    In local storage mode, this copies from LOCAL_STORAGE_DIR to sandbox data dir.
    In Supabase mode, this downloads from Supabase to sandbox data dir.

    Args:
        storage_path: Path in storage (e.g., "user_id/filename.csv")
        sandbox_path: Optional custom path in sandbox (default: /home/user/data/{filename})
        local_base_dir: Optional base directory for local files

    Returns:
        Local file path where the file was saved, or None if failed
    """
    # Determine filename
    filename = os.path.basename(storage_path)

    # Determine local destination path - use persistent data directory
    user_id, storage_filename = _split_local_storage_path(storage_path)
    if local_base_dir:
        base_dir = Path(local_base_dir)
    else:
        base_dir = get_local_data_dir(user_id)

    base_dir.mkdir(parents=True, exist_ok=True)
    local_path = base_dir / filename

    if USE_LOCAL_STORAGE:
        # Local storage mode - copy from webapp storage to sandbox data dir
        source_path = get_local_data_dir(user_id) / storage_filename
        try:
            if source_path.exists():
                if source_path.resolve() == local_path.resolve():
                    return str(source_path)
                shutil.copy2(source_path, local_path)
                print(f"[LocalStorage] Synced file: {source_path} -> {local_path}")
                return str(local_path)
            else:
                print(f"[LocalStorage] Source file not found: {source_path}")
                return None
        except Exception as e:
            print(f"[LocalStorage] Failed to sync file: {e}")
            return None
    else:
        # Supabase storage mode - download content
        content = get_file_content(storage_path)
        if content is None:
            return None

        # Write file
        try:
            with open(local_path, "wb") as f:
                f.write(content)
            return str(local_path)
        except Exception as e:
            print(f"Failed to write file to local path: {e}")
            return None


def sync_file_to_e2b(sandbox, storage_path: str, sandbox_path: Optional[str] = None) -> Optional[str]:
    """
    Sync file from storage to E2B sandbox.

    In local storage mode, reads from LOCAL_STORAGE_DIR.
    In Supabase mode, downloads from Supabase.

    Args:
        sandbox: E2B sandbox instance
        storage_path: Path in storage (e.g., "user_id/filename.csv")
        sandbox_path: Optional custom path in sandbox (default: /home/user/data/{filename})

    Returns:
        Sandbox file path where the file was saved, or None if failed
    """
    print(f"[sync_file_to_e2b] Starting sync for storage_path={storage_path}")

    # Get file content (handles both local and Supabase modes)
    content = get_file_content(storage_path)
    if content is None:
        print(f"[sync_file_to_e2b] get_file_content returned None for {storage_path}")
        return None

    print(f"[sync_file_to_e2b] Got {len(content)} bytes from storage")

    # Determine filename and sandbox path
    filename = os.path.basename(storage_path)
    if sandbox_path is None:
        sandbox_path = f"{SANDBOX_DATA_DIR}/{filename}"

    print(f"[sync_file_to_e2b] Target sandbox_path={sandbox_path}")

    # Ensure directory exists in sandbox
    sandbox_dir = os.path.dirname(sandbox_path)

    try:
        # Create directory in E2B sandbox
        # Note: E2B SDK v1 uses sandbox.files instead of sandbox.filesystem
        print(f"[sync_file_to_e2b] Creating directory {sandbox_dir} in sandbox")
        sandbox.files.make_dir(sandbox_dir)
        print(f"[sync_file_to_e2b] Directory created successfully")
    except Exception as e:
        print(f"[sync_file_to_e2b] Directory creation note: {e}")  # Directory might already exist

    try:
        # Write file to E2B sandbox
        # Note: E2B SDK v1 uses sandbox.files.write() instead of sandbox.filesystem.write_bytes()
        print(f"[sync_file_to_e2b] Writing {len(content)} bytes to {sandbox_path}")
        sandbox.files.write(sandbox_path, content)
        print(f"[sync_file_to_e2b] Successfully wrote file to {sandbox_path}")
        return sandbox_path
    except Exception as e:
        print(f"[sync_file_to_e2b] Failed to write file to E2B sandbox: {e}")
        import traceback
        print(f"[sync_file_to_e2b] Traceback: {traceback.format_exc()}")
        return None


def sync_files_to_local(
    files: list[dict],
    local_base_dir: Optional[str] = None,
) -> list[dict]:
    """
    Sync multiple files from Supabase to local filesystem.

    Args:
        files: List of file info dicts with 'storage_path' key
        local_base_dir: Optional base directory for local files

    Returns:
        List of file info dicts with added 'local_path' key
    """
    results = []
    for file_info in files:
        storage_path = file_info.get("storage_path")
        if not storage_path:
            continue

        local_path = sync_file_to_local(
            storage_path=storage_path,
            local_base_dir=local_base_dir,
        )

        result = file_info.copy()
        result["local_path"] = local_path
        result["sandbox_path"] = f"{SANDBOX_DATA_DIR}/{os.path.basename(storage_path)}"
        results.append(result)

    return results


def sync_files_to_e2b(sandbox, files: list[dict]) -> list[dict]:
    """
    Sync multiple files from Supabase to E2B sandbox.

    Args:
        sandbox: E2B sandbox instance
        files: List of file info dicts with 'storage_path' key

    Returns:
        List of file info dicts with added 'sandbox_path' key
    """
    results = []
    for file_info in files:
        storage_path = file_info.get("storage_path")
        if not storage_path:
            continue

        sandbox_path = sync_file_to_e2b(
            sandbox=sandbox,
            storage_path=storage_path,
        )

        result = file_info.copy()
        result["sandbox_path"] = sandbox_path
        results.append(result)

    return results


def get_sandbox_file_path(storage_path: str) -> str:
    """
    Get the expected sandbox path for a storage file.

    Args:
        storage_path: Path in Supabase storage

    Returns:
        Expected path in sandbox
    """
    filename = os.path.basename(storage_path)
    return f"{SANDBOX_DATA_DIR}/{filename}"


# =============================================================================
# Auto-sync Supabase files to Local
# =============================================================================

def list_supabase_files(user_id: str = "default") -> list[dict]:
    """
    List all files for a user in Supabase storage.

    Args:
        user_id: User identifier (default: "default")

    Returns:
        List of file info dicts with 'name' and 'storage_path'
    """
    print(f"[FileSync] list_supabase_files called with user_id={user_id}")
    print(f"[FileSync] USE_LOCAL_STORAGE={USE_LOCAL_STORAGE}")
    print(f"[FileSync] SUPABASE_URL={SUPABASE_URL[:30] if SUPABASE_URL else None}...")
    print(f"[FileSync] SUPABASE_SERVICE_KEY configured: {bool(SUPABASE_SERVICE_KEY)}")

    if USE_LOCAL_STORAGE:
        # In local storage mode, list only this guest's files.
        files = []
        local_dir = get_local_data_dir(user_id)
        print(f"[FileSync] LOCAL_STORAGE_DIR={local_dir}")
        try:
            if local_dir.exists():
                for item in local_dir.iterdir():
                    if item.is_file():
                        files.append({
                            "name": item.name,
                            "storage_path": f"{user_id}/{item.name}",
                        })
                        print(f"[FileSync] Found local file: {item.name}")
            else:
                print(f"[FileSync] LOCAL_STORAGE_DIR does not exist")
        except Exception as e:
            print(f"[FileSync] Failed to list local files: {e}")
            import traceback
            print(f"[FileSync] Traceback: {traceback.format_exc()}")
        print(f"[FileSync] Returning {len(files)} local files")
        return files
    else:
        # In Supabase mode, list files from bucket
        print(f"[FileSync] ========== SUPABASE QUERY DEBUG ==========")
        print(f"[FileSync] Bucket: {BUCKET_NAME}")
        print(f"[FileSync] Query path: '{user_id}'")
        client = get_supabase_client()
        if not client:
            print(f"[FileSync] ERROR: Failed to get Supabase client!")
            return []

        try:
            print(f"[FileSync] Calling client.storage.from_('{BUCKET_NAME}').list(path='{user_id}')")
            result = client.storage.from_(BUCKET_NAME).list(path=user_id)
            print(f"[FileSync] Raw result type: {type(result)}")
            print(f"[FileSync] Raw result count: {len(result) if result else 0}")
            print(f"[FileSync] Raw result: {result[:5] if result and len(result) > 5 else result}")
            files = []
            for item in result:
                if item.get("name"):
                    files.append({
                        "name": item["name"],
                        "storage_path": f"{user_id}/{item['name']}",
                    })
                    print(f"[FileSync] Found Supabase file: {user_id}/{item['name']}")
            print(f"[FileSync] Returning {len(files)} Supabase files")
            return files
        except Exception as e:
            print(f"[FileSync] Failed to list Supabase files: {e}")
            import traceback
            print(f"[FileSync] Traceback: {traceback.format_exc()}")
            return []


def sync_all_supabase_files_to_local(user_id: str = "default") -> list[dict]:
    """
    Sync ALL files from Supabase storage to local data directory.

    This function should be called before code execution in local sandbox mode
    to ensure all user-uploaded files are available locally.

    Args:
        user_id: User identifier (default: "default")

    Returns:
        List of synced file info dicts with 'name', 'storage_path', 'local_path'
    """
    if USE_LOCAL_STORAGE:
        # In local storage mode, files are already in the right place
        # Just return the list of files
        local_dir = get_local_data_dir(user_id)
        files = []
        try:
            if local_dir.exists():
                for item in local_dir.iterdir():
                    if item.is_file():
                        files.append({
                            "name": item.name,
                            "storage_path": f"{user_id}/{item.name}",
                            "local_path": str(item),
                            "sandbox_path": f"{SANDBOX_DATA_DIR}/{item.name}",
                        })
            print(f"[LocalStorage] Found {len(files)} files already available locally")
        except Exception as e:
            print(f"[LocalStorage] Error listing local files: {e}")
        return files

    # In Supabase mode, download all files to local
    print(f"[Supabase] Starting sync of all files for user: {user_id}")

    # Get list of files in Supabase
    remote_files = list_supabase_files(user_id)

    if not remote_files:
        print("[Supabase] No files found in storage")
        return []

    print(f"[Supabase] Found {len(remote_files)} files to sync")

    # Sync each file
    synced_files = []
    for file_info in remote_files:
        storage_path = file_info["storage_path"]
        filename = file_info["name"]

        # Check if file already exists locally
        local_dir = get_local_data_dir(user_id)
        local_path = local_dir / filename

        if local_path.exists():
            # File already synced
            print(f"[Supabase] File already exists locally: {filename}")
            synced_files.append({
                "name": filename,
                "storage_path": storage_path,
                "local_path": str(local_path),
                "sandbox_path": f"{SANDBOX_DATA_DIR}/{filename}",
                "synced": False,  # Already existed
            })
        else:
            # Download from Supabase
            result_path = sync_file_to_local(storage_path)
            if result_path:
                print(f"[Supabase] Synced file: {filename}")
                synced_files.append({
                    "name": filename,
                    "storage_path": storage_path,
                    "local_path": result_path,
                    "sandbox_path": f"{SANDBOX_DATA_DIR}/{filename}",
                    "synced": True,  # Newly downloaded
                })
            else:
                print(f"[Supabase] Failed to sync file: {filename}")

    print(f"[Supabase] Sync complete: {len(synced_files)} files available locally")
    return synced_files
