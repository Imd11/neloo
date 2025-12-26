"""
Image Storage Module

Provides unified image storage with support for:
- Local filesystem (development mode)
- Supabase Storage (production/E2B mode)

Features:
- Automatic cleanup of old images (TTL-based)
- UUID-based image IDs for security
- Thread ID association for session-based cleanup
- Size validation to prevent abuse
- Non-blocking async operations via thread pool
"""

import os
import base64
import secrets
import hashlib
import hmac
import tempfile
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from abc import ABC, abstractmethod


# =============================================================================
# Configuration
# =============================================================================

# Local storage directory
IMAGE_STORAGE_DIR = Path(tempfile.gettempdir()) / "data-analyst-images"

# Supabase bucket name
IMAGE_BUCKET_NAME = "data-analyst-images"

# Image TTL (time to live) in hours
IMAGE_TTL_HOURS = 24

# Maximum image size (5 MB)
MAX_IMAGE_SIZE = 5 * 1024 * 1024

# Secret key for URL signing (generate if not set)
IMAGE_SECRET_KEY = os.environ.get("IMAGE_SECRET_KEY", secrets.token_hex(32))

# Check storage mode
# IMAGE_USE_LOCAL_STORAGE=true forces local storage even with Supabase configured
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
FORCE_LOCAL_STORAGE = os.environ.get("IMAGE_USE_LOCAL_STORAGE", "").lower() == "true"
USE_LOCAL_STORAGE = FORCE_LOCAL_STORAGE or not (SUPABASE_URL and SUPABASE_SERVICE_KEY)


# =============================================================================
# Image ID Generation
# =============================================================================

def generate_image_id(thread_id: Optional[str] = None) -> str:
    """
    Generate a unique image ID.

    Format: {timestamp}_{random}_{thread_hash}
    - timestamp: For TTL cleanup
    - random: 128-bit random for security
    - thread_hash: Optional thread association for cleanup
    """
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_part = secrets.token_hex(16)  # 128 bits

    if thread_id:
        thread_hash = hashlib.sha256(thread_id.encode()).hexdigest()[:8]
        return f"{timestamp}_{random_part}_{thread_hash}"

    return f"{timestamp}_{random_part}"


def generate_url_signature(image_id: str) -> str:
    """Generate HMAC signature for image URL."""
    return hmac.new(
        IMAGE_SECRET_KEY.encode(),
        image_id.encode(),
        hashlib.sha256
    ).hexdigest()[:16]


def verify_url_signature(image_id: str, signature: str) -> bool:
    """Verify HMAC signature for image URL."""
    expected = generate_url_signature(image_id)
    return hmac.compare_digest(expected, signature)


def parse_image_timestamp(image_id: str) -> Optional[datetime]:
    """Parse timestamp from image ID for TTL cleanup."""
    try:
        timestamp_str = image_id.split("_")[0]
        return datetime.strptime(timestamp_str, "%Y%m%d%H%M%S")
    except (ValueError, IndexError):
        return None


# =============================================================================
# Storage Backend Interface
# =============================================================================

class ImageStorageBackend(ABC):
    """Abstract base class for image storage backends."""

    @abstractmethod
    def save(self, image_id: str, data: bytes) -> bool:
        """Save image data. Returns True on success."""
        pass

    @abstractmethod
    def get(self, image_id: str) -> Optional[bytes]:
        """Get image data by ID. Returns None if not found."""
        pass

    @abstractmethod
    def delete(self, image_id: str) -> bool:
        """Delete image by ID. Returns True on success."""
        pass

    @abstractmethod
    def cleanup_old(self, max_age_hours: int = IMAGE_TTL_HOURS) -> int:
        """Delete images older than max_age_hours. Returns count deleted."""
        pass


# =============================================================================
# Local Storage Backend
# =============================================================================

class LocalImageStorage(ImageStorageBackend):
    """Local filesystem storage for development."""

    def __init__(self, storage_dir: Path = IMAGE_STORAGE_DIR):
        self.storage_dir = storage_dir
        self._initialized = False

    def _ensure_dir(self) -> None:
        """Ensure storage directory exists (called lazily)."""
        if not self._initialized:
            self.storage_dir.mkdir(parents=True, exist_ok=True)
            self._initialized = True

    def _get_path(self, image_id: str) -> Path:
        """Get file path for image ID."""
        # Sanitize image_id to prevent path traversal
        safe_id = "".join(c for c in image_id if c.isalnum() or c == "_")
        return self.storage_dir / f"{safe_id}.png"

    def save(self, image_id: str, data: bytes) -> bool:
        """Save image to local filesystem."""
        try:
            if len(data) > MAX_IMAGE_SIZE:
                print(f"[ImageStorage] Image too large: {len(data)} bytes")
                return False

            self._ensure_dir()
            path = self._get_path(image_id)
            path.write_bytes(data)
            print(f"[ImageStorage] Saved image: {path}")
            return True
        except Exception as e:
            print(f"[ImageStorage] Save error: {e}")
            return False

    def get(self, image_id: str) -> Optional[bytes]:
        """Get image from local filesystem."""
        try:
            path = self._get_path(image_id)
            if path.exists():
                return path.read_bytes()
            return None
        except Exception as e:
            print(f"[ImageStorage] Get error: {e}")
            return None

    def delete(self, image_id: str) -> bool:
        """Delete image from local filesystem."""
        try:
            path = self._get_path(image_id)
            if path.exists():
                path.unlink()
                return True
            return False
        except Exception as e:
            print(f"[ImageStorage] Delete error: {e}")
            return False

    def cleanup_old(self, max_age_hours: int = IMAGE_TTL_HOURS) -> int:
        """Delete images older than max_age_hours."""
        deleted = 0
        cutoff = datetime.now() - timedelta(hours=max_age_hours)

        try:
            for path in self.storage_dir.glob("*.png"):
                # Parse timestamp from filename
                image_id = path.stem
                timestamp = parse_image_timestamp(image_id)

                if timestamp and timestamp < cutoff:
                    try:
                        path.unlink()
                        deleted += 1
                    except Exception:
                        pass
        except Exception as e:
            print(f"[ImageStorage] Cleanup error: {e}")

        if deleted > 0:
            print(f"[ImageStorage] Cleaned up {deleted} old images")

        return deleted


# =============================================================================
# Supabase Storage Backend
# =============================================================================

class SupabaseImageStorage(ImageStorageBackend):
    """Supabase Storage backend for production/E2B.

    Uses thread pool to avoid blocking the event loop when called from async context.
    """

    def __init__(self):
        self._client = None

    def _get_client(self):
        """Lazy initialization of Supabase client."""
        if self._client is None:
            from supabase import create_client
            self._client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        return self._client

    def _get_path(self, image_id: str) -> str:
        """Get storage path for image ID."""
        # Store in images/ prefix
        safe_id = "".join(c for c in image_id if c.isalnum() or c == "_")
        return f"images/{safe_id}.png"

    def _save_sync(self, image_id: str, data: bytes) -> bool:
        """Synchronous save implementation."""
        try:
            if len(data) > MAX_IMAGE_SIZE:
                print(f"[ImageStorage] Image too large: {len(data)} bytes")
                return False

            client = self._get_client()
            path = self._get_path(image_id)

            client.storage.from_(IMAGE_BUCKET_NAME).upload(
                path=path,
                file=data,
                file_options={"content-type": "image/png"}
            )
            print(f"[ImageStorage] Saved image to Supabase: {path}")
            return True
        except Exception as e:
            print(f"[ImageStorage] Supabase save error: {e}")
            return False

    def save(self, image_id: str, data: bytes) -> bool:
        """Save image to Supabase Storage (runs in thread pool if in async context)."""
        try:
            loop = asyncio.get_running_loop()
            # We're in an async context, run sync code in thread pool
            future = loop.run_in_executor(None, self._save_sync, image_id, data)
            # Use asyncio.run_coroutine_threadsafe alternative pattern
            # Since we're already in an event loop, we can't block on the future
            # Instead, schedule it and return optimistically
            # This is a fire-and-forget pattern for non-blocking saves
            asyncio.ensure_future(asyncio.wrap_future(future))
            return True  # Optimistic return
        except RuntimeError:
            # No running event loop, safe to call sync directly
            return self._save_sync(image_id, data)

    def _get_sync(self, image_id: str) -> Optional[bytes]:
        """Synchronous get implementation."""
        try:
            client = self._get_client()
            path = self._get_path(image_id)
            response = client.storage.from_(IMAGE_BUCKET_NAME).download(path)
            return response
        except Exception as e:
            print(f"[ImageStorage] Supabase get error: {e}")
            return None

    def get(self, image_id: str) -> Optional[bytes]:
        """Get image from Supabase Storage."""
        # For get operations, we need the result immediately
        # Use sync call (this should only be called from async endpoints which can await)
        return self._get_sync(image_id)

    def _delete_sync(self, image_id: str) -> bool:
        """Synchronous delete implementation."""
        try:
            client = self._get_client()
            path = self._get_path(image_id)
            client.storage.from_(IMAGE_BUCKET_NAME).remove([path])
            return True
        except Exception as e:
            print(f"[ImageStorage] Supabase delete error: {e}")
            return False

    def delete(self, image_id: str) -> bool:
        """Delete image from Supabase Storage."""
        return self._delete_sync(image_id)

    def _cleanup_sync(self, max_age_hours: int) -> int:
        """Synchronous cleanup implementation."""
        deleted = 0
        cutoff = datetime.now() - timedelta(hours=max_age_hours)

        try:
            client = self._get_client()

            # List all files in images/ folder
            result = client.storage.from_(IMAGE_BUCKET_NAME).list(path="images")

            paths_to_delete = []
            for item in result:
                if not item.get("name"):
                    continue

                image_id = item["name"].replace(".png", "")
                timestamp = parse_image_timestamp(image_id)

                if timestamp and timestamp < cutoff:
                    paths_to_delete.append(f"images/{item['name']}")

            if paths_to_delete:
                client.storage.from_(IMAGE_BUCKET_NAME).remove(paths_to_delete)
                deleted = len(paths_to_delete)
                print(f"[ImageStorage] Cleaned up {deleted} old images from Supabase")

        except Exception as e:
            print(f"[ImageStorage] Supabase cleanup error: {e}")

        return deleted

    def cleanup_old(self, max_age_hours: int = IMAGE_TTL_HOURS) -> int:
        """Delete images older than max_age_hours from Supabase."""
        return self._cleanup_sync(max_age_hours)


# =============================================================================
# Unified ImageStorage Class
# =============================================================================

class ImageStorage:
    """
    Unified image storage interface.

    Automatically selects backend based on environment:
    - Local storage when SUPABASE_URL/KEY not set
    - Supabase Storage when configured
    """

    def __init__(self):
        if USE_LOCAL_STORAGE:
            print("[ImageStorage] Using local storage backend")
            self._backend = LocalImageStorage()
        else:
            print("[ImageStorage] Using Supabase storage backend")
            self._backend = SupabaseImageStorage()

    def save_image(
        self,
        data: bytes,
        thread_id: Optional[str] = None,
        user_id: str = "default",
    ) -> Optional[dict]:
        """
        Save image and return info dict.

        Args:
            data: Image bytes (PNG format)
            thread_id: Optional thread ID for association
            user_id: User ID for file ownership

        Returns:
            dict with:
            - image_id: Unique image identifier
            - signature: URL signature for verification
            - url_path: Relative URL path for the image
        """
        image_id = generate_image_id(thread_id)
        signature = generate_url_signature(image_id)

        if self._backend.save(image_id, data):
            result = {
                "image_id": image_id,
                "signature": signature,
                "url_path": f"/images/{image_id}?sig={signature}",
            }

            # Save to database if Supabase DB is enabled
            # Note: Database save is non-critical - file is already in storage
            try:
                import os
                supabase_url = os.environ.get("SUPABASE_URL")
                if supabase_url:
                    from .supabase_db import save_file_record
                    import asyncio

                    # Determine storage path based on backend
                    if USE_LOCAL_STORAGE:
                        storage_path = f"local/images/{image_id}.png"
                    else:
                        storage_path = f"images/{image_id}.png"

                    # Save to database (async with proper error handling)
                    try:
                        loop = asyncio.get_running_loop()
                        # Create task with error callback
                        task = asyncio.create_task(save_file_record(
                            user_id=user_id,
                            filename=f"{image_id}.png",
                            storage_path=storage_path,
                            file_size=len(data),
                            content_type="image/png",
                            file_type="chart",
                            thread_id=thread_id,
                        ))

                        # Add callback to log completion/errors
                        def on_complete(future):
                            try:
                                result = future.result()
                                if result:
                                    print(f"[ImageStorage] ✓ Database record saved: {image_id}.png")
                                else:
                                    print(f"[ImageStorage] ✗ Database save returned None for: {image_id}.png")
                            except Exception as e:
                                print(f"[ImageStorage] ✗ Database save failed for {image_id}.png: {e}")

                        task.add_done_callback(on_complete)
                    except RuntimeError:
                        # No event loop running
                        print(f"[ImageStorage] Warning: No event loop, database save skipped for: {image_id}.png")
            except Exception as db_error:
                # Log database error but don't fail the image save
                print(f"[ImageStorage] Warning: Database initialization error for {image_id}: {db_error}")

            return result
        return None

    def save_image_base64(
        self,
        base64_data: str,
        thread_id: Optional[str] = None,
        user_id: str = "default",
    ) -> Optional[dict]:
        """
        Save base64-encoded image.

        Args:
            base64_data: Base64 encoded PNG image
            thread_id: Optional thread ID
            user_id: User ID for file ownership

        Returns:
            Same as save_image()
        """
        try:
            data = base64.b64decode(base64_data)
            return self.save_image(data, thread_id, user_id)
        except Exception as e:
            print(f"[ImageStorage] Base64 decode error: {e}")
            return None

    def get_image(self, image_id: str) -> Optional[bytes]:
        """Get image bytes by ID."""
        return self._backend.get(image_id)

    def get_image_url(
        self,
        image_id: str,
        base_url: Optional[str] = None,
    ) -> str:
        """
        Get full URL for an image.

        Args:
            image_id: Image identifier
            base_url: Optional base URL (e.g., "http://localhost:2024")

        Returns:
            Full URL to access the image
        """
        signature = generate_url_signature(image_id)
        path = f"/images/{image_id}?sig={signature}"

        if base_url:
            return f"{base_url.rstrip('/')}{path}"
        return path

    def verify_signature(self, image_id: str, signature: str) -> bool:
        """Verify URL signature."""
        return verify_url_signature(image_id, signature)

    def delete_image(self, image_id: str) -> bool:
        """Delete image by ID."""
        return self._backend.delete(image_id)

    def cleanup_old_images(self, max_age_hours: int = IMAGE_TTL_HOURS) -> int:
        """Delete images older than max_age_hours."""
        return self._backend.cleanup_old(max_age_hours)


# =============================================================================
# Module-level Singleton & Convenience Functions
# =============================================================================

_storage: Optional[ImageStorage] = None


def get_image_storage() -> ImageStorage:
    """Get the global ImageStorage instance."""
    global _storage
    if _storage is None:
        _storage = ImageStorage()
    return _storage


def save_image(
    data: bytes,
    thread_id: Optional[str] = None,
    user_id: str = "default",
) -> Optional[dict]:
    """Convenience function to save image."""
    return get_image_storage().save_image(data, thread_id, user_id)


def save_image_base64(
    base64_data: str,
    thread_id: Optional[str] = None,
    user_id: str = "default",
) -> Optional[dict]:
    """Convenience function to save base64 image."""
    return get_image_storage().save_image_base64(base64_data, thread_id, user_id)


def get_image(image_id: str) -> Optional[bytes]:
    """Convenience function to get image."""
    return get_image_storage().get_image(image_id)


def get_image_url(
    image_id: str,
    base_url: Optional[str] = None,
) -> str:
    """Convenience function to get image URL."""
    return get_image_storage().get_image_url(image_id, base_url)


def cleanup_old_images(max_age_hours: int = IMAGE_TTL_HOURS) -> int:
    """Convenience function to cleanup old images."""
    return get_image_storage().cleanup_old_images(max_age_hours)
