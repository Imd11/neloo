"""
Generated File Storage Module

Provides unified file storage for Agent-generated files with support for:
- Local filesystem (development mode)
- Supabase Storage (production/E2B mode)

Features:
- Supports any file type (txt, csv, xlsx, pdf, etc.)
- User-based file organization
- Thread ID association for session-based management
- Automatic cleanup of old files (TTL-based)
- Download URL generation with signature verification
- Database integration for file metadata (files table)

This module handles files generated during code execution (reports, processed data, etc.)
Unlike image_storage.py which is for chart images, this handles downloadable artifacts.
"""

import os
import base64
import secrets
import hashlib
import hmac
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any, Literal
from abc import ABC, abstractmethod

# Import database operations
from .supabase_db import save_file_record, FileType, USE_SUPABASE_DB


# =============================================================================
# Configuration
# =============================================================================

# Local storage directory for generated files
FILE_STORAGE_DIR = Path(tempfile.gettempdir()) / "data-analyst-generated-files"

# Supabase bucket name for generated files
FILE_BUCKET_NAME = "data-analyst-generated"

# File TTL (time to live) in hours
FILE_TTL_HOURS = 72  # 3 days for generated files

# Maximum file size (50 MB)
MAX_FILE_SIZE = 50 * 1024 * 1024

# Secret key for URL signing
FILE_SECRET_KEY = os.environ.get("FILE_SECRET_KEY", secrets.token_hex(32))

# Check storage mode
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
FORCE_LOCAL_STORAGE = os.environ.get("FILE_USE_LOCAL_STORAGE", "").lower() == "true"
USE_LOCAL_STORAGE = FORCE_LOCAL_STORAGE or not (SUPABASE_URL and SUPABASE_SERVICE_KEY)

# MIME type mapping
MIME_TYPES = {
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".json": "application/json",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".html": "text/html",
    ".md": "text/markdown",
    ".py": "text/x-python",
}


# =============================================================================
# File ID Generation
# =============================================================================

def generate_file_id(
    filename: str,
    user_id: str = "default",
    thread_id: Optional[str] = None
) -> str:
    """
    Generate a unique file ID.

    Format: {user_id}/{timestamp}_{random}_{filename}
    """
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_part = secrets.token_hex(8)  # 64 bits

    # Sanitize filename
    safe_filename = "".join(c for c in filename if c.isalnum() or c in "._-")

    if thread_id:
        thread_hash = hashlib.sha256(thread_id.encode()).hexdigest()[:8]
        return f"{user_id}/{timestamp}_{random_part}_{thread_hash}_{safe_filename}"

    return f"{user_id}/{timestamp}_{random_part}_{safe_filename}"


def generate_url_signature(file_id: str) -> str:
    """Generate HMAC signature for file URL."""
    return hmac.new(
        FILE_SECRET_KEY.encode(),
        file_id.encode(),
        hashlib.sha256
    ).hexdigest()[:16]


def verify_url_signature(file_id: str, signature: str) -> bool:
    """Verify HMAC signature for file URL."""
    expected = generate_url_signature(file_id)
    return hmac.compare_digest(expected, signature)


def parse_file_timestamp(file_id: str) -> Optional[datetime]:
    """Parse timestamp from file ID for TTL cleanup."""
    try:
        # Format: user_id/timestamp_random_filename
        parts = file_id.split("/")
        if len(parts) >= 2:
            timestamp_str = parts[1].split("_")[0]
            return datetime.strptime(timestamp_str, "%Y%m%d%H%M%S")
        return None
    except (ValueError, IndexError):
        return None


def get_mime_type(filename: str) -> str:
    """Get MIME type for a filename."""
    ext = Path(filename).suffix.lower()
    return MIME_TYPES.get(ext, "application/octet-stream")


# =============================================================================
# Storage Backend Interface
# =============================================================================

class FileStorageBackend(ABC):
    """Abstract base class for file storage backends."""

    @abstractmethod
    def save(self, file_id: str, data: bytes, content_type: str) -> bool:
        """Save file data. Returns True on success."""
        pass

    @abstractmethod
    def get(self, file_id: str) -> Optional[bytes]:
        """Get file data by ID. Returns None if not found."""
        pass

    @abstractmethod
    def delete(self, file_id: str) -> bool:
        """Delete file by ID. Returns True on success."""
        pass

    @abstractmethod
    def list_files(self, user_id: str) -> List[Dict[str, Any]]:
        """List all files for a user."""
        pass

    @abstractmethod
    def cleanup_old(self, max_age_hours: int = FILE_TTL_HOURS) -> int:
        """Delete files older than max_age_hours. Returns count deleted."""
        pass


# =============================================================================
# Local Storage Backend
# =============================================================================

class LocalFileStorage(FileStorageBackend):
    """Local filesystem storage for development."""

    def __init__(self, storage_dir: Path = FILE_STORAGE_DIR):
        self.storage_dir = storage_dir
        self._initialized = False

    def _ensure_dir(self, subdir: str = "") -> Path:
        """Ensure storage directory exists."""
        target_dir = self.storage_dir / subdir if subdir else self.storage_dir
        target_dir.mkdir(parents=True, exist_ok=True)
        return target_dir

    def _get_path(self, file_id: str) -> Path:
        """Get file path for file ID."""
        # file_id format: user_id/timestamp_random_filename
        return self.storage_dir / file_id

    def save(self, file_id: str, data: bytes, content_type: str) -> bool:
        """Save file to local filesystem."""
        try:
            if len(data) > MAX_FILE_SIZE:
                print(f"[FileStorage] File too large: {len(data)} bytes")
                return False

            path = self._get_path(file_id)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            print(f"[FileStorage] Saved file: {path}")
            return True
        except Exception as e:
            print(f"[FileStorage] Save error: {e}")
            return False

    def get(self, file_id: str) -> Optional[bytes]:
        """Get file from local filesystem."""
        try:
            path = self._get_path(file_id)
            if path.exists():
                return path.read_bytes()
            return None
        except Exception as e:
            print(f"[FileStorage] Get error: {e}")
            return None

    def delete(self, file_id: str) -> bool:
        """Delete file from local filesystem."""
        try:
            path = self._get_path(file_id)
            if path.exists():
                path.unlink()
                return True
            return False
        except Exception as e:
            print(f"[FileStorage] Delete error: {e}")
            return False

    def list_files(self, user_id: str) -> List[Dict[str, Any]]:
        """List all files for a user."""
        files = []
        user_dir = self.storage_dir / user_id

        try:
            if user_dir.exists():
                for path in user_dir.iterdir():
                    if path.is_file():
                        file_id = f"{user_id}/{path.name}"
                        files.append({
                            "file_id": file_id,
                            "filename": path.name.split("_", 3)[-1] if "_" in path.name else path.name,
                            "size": path.stat().st_size,
                            "created_at": datetime.fromtimestamp(path.stat().st_ctime).isoformat(),
                            "content_type": get_mime_type(path.name),
                        })
        except Exception as e:
            print(f"[FileStorage] List error: {e}")

        return files

    def cleanup_old(self, max_age_hours: int = FILE_TTL_HOURS) -> int:
        """Delete files older than max_age_hours."""
        deleted = 0
        cutoff = datetime.now() - timedelta(hours=max_age_hours)

        try:
            for user_dir in self.storage_dir.iterdir():
                if not user_dir.is_dir():
                    continue

                for path in user_dir.iterdir():
                    if not path.is_file():
                        continue

                    file_id = f"{user_dir.name}/{path.name}"
                    timestamp = parse_file_timestamp(file_id)

                    if timestamp and timestamp < cutoff:
                        try:
                            path.unlink()
                            deleted += 1
                        except Exception:
                            pass
        except Exception as e:
            print(f"[FileStorage] Cleanup error: {e}")

        if deleted > 0:
            print(f"[FileStorage] Cleaned up {deleted} old files")

        return deleted


# =============================================================================
# Supabase Storage Backend
# =============================================================================

class SupabaseFileStorage(FileStorageBackend):
    """Supabase Storage backend for production."""

    def __init__(self):
        self._client = None

    def _get_client(self):
        """Lazy initialization of Supabase client."""
        if self._client is None:
            from supabase import create_client
            self._client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        return self._client

    def _ensure_bucket(self) -> bool:
        """Ensure the bucket exists, create if not."""
        try:
            client = self._get_client()
            # Try to get bucket info
            try:
                client.storage.get_bucket(FILE_BUCKET_NAME)
                return True
            except Exception:
                # Bucket doesn't exist, create it
                client.storage.create_bucket(
                    FILE_BUCKET_NAME,
                    options={"public": False}
                )
                print(f"[FileStorage] Created Supabase bucket: {FILE_BUCKET_NAME}")
                return True
        except Exception as e:
            print(f"[FileStorage] Bucket setup error: {e}")
            return False

    def save(self, file_id: str, data: bytes, content_type: str) -> bool:
        """Save file to Supabase Storage."""
        try:
            if len(data) > MAX_FILE_SIZE:
                print(f"[FileStorage] File too large: {len(data)} bytes")
                return False

            self._ensure_bucket()
            client = self._get_client()

            client.storage.from_(FILE_BUCKET_NAME).upload(
                path=file_id,
                file=data,
                file_options={"content-type": content_type}
            )
            print(f"[FileStorage] Saved file to Supabase: {file_id}")
            return True
        except Exception as e:
            print(f"[FileStorage] Supabase save error: {e}")
            return False

    def get(self, file_id: str) -> Optional[bytes]:
        """Get file from Supabase Storage."""
        try:
            client = self._get_client()
            response = client.storage.from_(FILE_BUCKET_NAME).download(file_id)
            return response
        except Exception as e:
            print(f"[FileStorage] Supabase get error: {e}")
            return None

    def delete(self, file_id: str) -> bool:
        """Delete file from Supabase Storage."""
        try:
            client = self._get_client()
            client.storage.from_(FILE_BUCKET_NAME).remove([file_id])
            return True
        except Exception as e:
            print(f"[FileStorage] Supabase delete error: {e}")
            return False

    def list_files(self, user_id: str) -> List[Dict[str, Any]]:
        """List all files for a user."""
        files = []

        try:
            client = self._get_client()
            result = client.storage.from_(FILE_BUCKET_NAME).list(path=user_id)

            for item in result:
                if not item.get("name"):
                    continue

                file_id = f"{user_id}/{item['name']}"
                # Parse original filename from the stored name
                name_parts = item["name"].split("_", 3)
                original_name = name_parts[-1] if len(name_parts) >= 4 else item["name"]

                files.append({
                    "file_id": file_id,
                    "filename": original_name,
                    "size": item.get("metadata", {}).get("size", 0),
                    "created_at": item.get("created_at", ""),
                    "content_type": get_mime_type(original_name),
                })
        except Exception as e:
            print(f"[FileStorage] Supabase list error: {e}")

        return files

    def cleanup_old(self, max_age_hours: int = FILE_TTL_HOURS) -> int:
        """Delete files older than max_age_hours from Supabase."""
        deleted = 0
        cutoff = datetime.now() - timedelta(hours=max_age_hours)

        try:
            client = self._get_client()

            # List all user directories
            users = client.storage.from_(FILE_BUCKET_NAME).list()

            for user_item in users:
                if not user_item.get("name"):
                    continue

                user_id = user_item["name"]
                user_files = client.storage.from_(FILE_BUCKET_NAME).list(path=user_id)

                paths_to_delete = []
                for item in user_files:
                    if not item.get("name"):
                        continue

                    file_id = f"{user_id}/{item['name']}"
                    timestamp = parse_file_timestamp(file_id)

                    if timestamp and timestamp < cutoff:
                        paths_to_delete.append(file_id)

                if paths_to_delete:
                    client.storage.from_(FILE_BUCKET_NAME).remove(paths_to_delete)
                    deleted += len(paths_to_delete)

            if deleted > 0:
                print(f"[FileStorage] Cleaned up {deleted} old files from Supabase")

        except Exception as e:
            print(f"[FileStorage] Supabase cleanup error: {e}")

        return deleted


# =============================================================================
# Unified FileStorage Class
# =============================================================================

class GeneratedFileStorage:
    """
    Unified file storage interface for agent-generated files.

    Automatically selects backend based on environment.
    """

    def __init__(self):
        if USE_LOCAL_STORAGE:
            print("[FileStorage] Using local storage backend")
            self._backend = LocalFileStorage()
        else:
            print("[FileStorage] Using Supabase storage backend")
            self._backend = SupabaseFileStorage()

    def save_file(
        self,
        filename: str,
        data: bytes,
        user_id: str = "default",
        thread_id: Optional[str] = None,
        file_type: FileType = "generated",
    ) -> Optional[Dict[str, Any]]:
        """
        Save a generated file and return info dict.

        Args:
            filename: Original filename (e.g., "report.txt")
            data: File content as bytes
            user_id: User identifier
            thread_id: Optional thread ID for association
            file_type: Type of file - 'uploaded', 'generated', 'chart', or 'code'

        Returns:
            dict with:
            - file_id: Unique file identifier
            - filename: Original filename
            - size: File size in bytes
            - content_type: MIME type
            - download_url: Relative URL path for download
            - signature: URL signature for verification
            - file_type: Type of file
            - db_record: Database record (if Supabase is configured)
        """
        file_id = generate_file_id(filename, user_id, thread_id)
        content_type = get_mime_type(filename)
        signature = generate_url_signature(file_id)

        if self._backend.save(file_id, data, content_type):
            result = {
                "file_id": file_id,
                "filename": filename,
                "size": len(data),
                "content_type": content_type,
                "download_url": f"/generated-files/{file_id}?sig={signature}",
                "signature": signature,
                "file_type": file_type,
            }

            # Save to database if Supabase is configured
            # CRITICAL: Use synchronous save to ensure database record is created
            # before returning. This function is called from sync context (executor.py,
            # graph.py tools), so we can safely use asyncio.run().
            if USE_SUPABASE_DB:
                import asyncio
                try:
                    # Verify we're not in an async context
                    asyncio.get_running_loop()
                    # If we get here, we're in async context - this shouldn't happen
                    # for the current call sites, but log it if it does
                    print(f"[FileStorage] Warning: save_file called from async context for {filename}")
                except RuntimeError:
                    # No running loop - safe to use asyncio.run()
                    pass

                try:
                    db_record = asyncio.run(save_file_record(
                        user_id=user_id,
                        filename=filename,
                        storage_path=file_id,
                        file_size=len(data),
                        content_type=content_type,
                        file_type=file_type,
                        thread_id=thread_id,
                    ))
                    if db_record:
                        result["db_record"] = db_record
                        print(f"[FileStorage] ✓ Database record saved: {filename}")
                    else:
                        print(f"[FileStorage] ✗ Database save returned None: {filename}")
                except Exception as e:
                    print(f"[FileStorage] ✗ Database save failed for {filename}: {e}")

            return result
        return None

    def get_file(self, file_id: str) -> Optional[bytes]:
        """Get file content by ID."""
        return self._backend.get(file_id)

    def get_download_url(
        self,
        file_id: str,
        base_url: Optional[str] = None,
    ) -> str:
        """Get full download URL for a file."""
        signature = generate_url_signature(file_id)
        path = f"/generated-files/{file_id}?sig={signature}"

        if base_url:
            return f"{base_url.rstrip('/')}{path}"
        return path

    def verify_signature(self, file_id: str, signature: str) -> bool:
        """Verify URL signature."""
        return verify_url_signature(file_id, signature)

    def delete_file(self, file_id: str) -> bool:
        """Delete file by ID."""
        return self._backend.delete(file_id)

    def list_user_files(self, user_id: str = "default") -> List[Dict[str, Any]]:
        """List all generated files for a user."""
        files = self._backend.list_files(user_id)

        # Add download URLs to each file
        for f in files:
            signature = generate_url_signature(f["file_id"])
            f["download_url"] = f"/generated-files/{f['file_id']}?sig={signature}"
            f["signature"] = signature

        return files

    def cleanup_old_files(self, max_age_hours: int = FILE_TTL_HOURS) -> int:
        """Delete files older than max_age_hours."""
        return self._backend.cleanup_old(max_age_hours)


# =============================================================================
# Module-level Singleton & Convenience Functions
# =============================================================================

_storage: Optional[GeneratedFileStorage] = None


def get_file_storage() -> GeneratedFileStorage:
    """Get the global GeneratedFileStorage instance."""
    global _storage
    if _storage is None:
        _storage = GeneratedFileStorage()
    return _storage


def save_generated_file(
    filename: str,
    data: bytes,
    user_id: str = "default",
    thread_id: Optional[str] = None,
    file_type: FileType = "generated",
) -> Optional[Dict[str, Any]]:
    """
    Convenience function to save a generated file.

    Args:
        filename: Original filename
        data: File content as bytes
        user_id: User identifier
        thread_id: Optional thread ID for association
        file_type: Type of file - 'uploaded', 'generated', 'chart', or 'code'
    """
    return get_file_storage().save_file(filename, data, user_id, thread_id, file_type)


def get_generated_file(file_id: str) -> Optional[bytes]:
    """Convenience function to get file content."""
    return get_file_storage().get_file(file_id)


def list_generated_files(user_id: str = "default") -> List[Dict[str, Any]]:
    """Convenience function to list user's generated files."""
    return get_file_storage().list_user_files(user_id)


def cleanup_old_generated_files(max_age_hours: int = FILE_TTL_HOURS) -> int:
    """Convenience function to cleanup old files."""
    return get_file_storage().cleanup_old_files(max_age_hours)
