"""
FastAPI Application for File Upload

This module provides custom HTTP routes for the LangGraph server,
specifically for handling data file uploads.

Storage modes:
- Supabase Storage (production): When SUPABASE_URL and SUPABASE_SERVICE_KEY are set
- Local Storage (development): Falls back to local filesystem storage

Routes:
- POST /files/upload - Upload a data file
- GET /files/list - List user's uploaded files
- DELETE /files/{filename} - Delete a file
- GET /files/download-url/{filename} - Get signed download URL
"""

import os
import uuid
import tempfile
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

# Import image storage
from ..storage import get_image, get_image_storage

# Import generated file storage
from ..storage.file_storage import (
    get_file_storage,
    get_generated_file,
    list_generated_files,
    get_mime_type,
)

# =============================================================================
# Configuration
# =============================================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
BUCKET_NAME = "data-analyst-files"

# Check if we're using local storage mode
USE_LOCAL_STORAGE = not (SUPABASE_URL and SUPABASE_SERVICE_KEY)

# Async Supabase client singleton
_supabase_client = None

# Local storage directory - use the sandbox data directory for simplicity
# This way uploaded files are directly available to the sandbox executor
LOCAL_STORAGE_DIR = Path(tempfile.gettempdir()) / "data-analyst-sandbox" / "data"
# Note: Directory creation moved to async context to avoid blocking

# Supported file extensions
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".dta", ".sav", ".parquet"}

# Maximum file size (100 MB)
MAX_FILE_SIZE = 100 * 1024 * 1024

# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="Data Analyst File API",
    description="File upload API for the Data Analyst Agent",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Storage Backend
# =============================================================================

async def get_supabase_client():
    """Get async Supabase client instance (only when Supabase is configured)."""
    global _supabase_client
    if USE_LOCAL_STORAGE:
        return None
    if _supabase_client is None:
        from supabase import acreate_client
        _supabase_client = await acreate_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_client


def get_local_storage_path(user_id: str) -> Path:
    """Get local storage path for a user.

    In local mode, files are stored directly in LOCAL_STORAGE_DIR (sandbox data dir)
    without user subdirectories for simplicity.

    Note: Caller must ensure directory exists via _ensure_storage_dir().
    """
    return LOCAL_STORAGE_DIR


async def _ensure_storage_dir() -> None:
    """Ensure local storage directory exists (runs in thread pool)."""
    await asyncio.to_thread(LOCAL_STORAGE_DIR.mkdir, parents=True, exist_ok=True)


def _write_file_sync(path: Path, content: bytes) -> None:
    """Write file synchronously (for use with asyncio.to_thread)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(content)


def _delete_file_sync(path: Path) -> bool:
    """Delete file synchronously (for use with asyncio.to_thread)."""
    if path.exists():
        path.unlink()
        return True
    return False


def _list_files_sync(directory: Path) -> list:
    """List files synchronously (for use with asyncio.to_thread)."""
    files = []
    if directory.exists():
        for item in directory.iterdir():
            if item.is_file():
                stat = item.stat()
                files.append({
                    "name": item.name,
                    "size": stat.st_size,
                    "ctime": stat.st_ctime,
                })
    return files


# =============================================================================
# Response Models
# =============================================================================

class UploadResponse(BaseModel):
    """Response model for file upload."""
    success: bool
    filename: str
    original_filename: str
    storage_path: str
    sandbox_path: str  # Actual path where file can be accessed in sandbox
    size: int
    message: str


class FileInfo(BaseModel):
    """Information about an uploaded file."""
    filename: str
    original_filename: str
    storage_path: str
    size: int
    created_at: str


class FileListResponse(BaseModel):
    """Response model for file list."""
    files: list[FileInfo]
    total: int


class DeleteResponse(BaseModel):
    """Response model for file deletion."""
    success: bool
    message: str


class DownloadUrlResponse(BaseModel):
    """Response model for download URL."""
    url: str
    expires_in: int


# =============================================================================
# Helper Functions
# =============================================================================

def validate_file(file: UploadFile) -> None:
    """Validate uploaded file."""
    # Check file extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )


def generate_storage_filename(original_filename: str) -> str:
    """Generate unique storage filename."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    ext = os.path.splitext(original_filename)[1].lower()
    # Sanitize original filename (remove special characters)
    base_name = os.path.splitext(original_filename)[0]
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in base_name)
    safe_name = safe_name[:50]  # Limit length
    return f"{timestamp}_{unique_id}_{safe_name}{ext}"


def get_user_id(x_user_id: Optional[str]) -> str:
    """Get user ID from header or use default."""
    # In production, this should come from authentication
    # For now, use a header or default to "default"
    return x_user_id or "default"


# =============================================================================
# API Routes
# =============================================================================

@app.post("/files/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    x_user_id: Optional[str] = Header(None),
):
    """
    Upload a data file.

    Storage mode is determined automatically:
    - If Supabase is configured: uploads to Supabase Storage
    - Otherwise: saves to local filesystem

    Supported formats: CSV, XLSX, XLS, DTA, SAV, Parquet
    Maximum size: 100 MB
    """
    # Validate file
    validate_file(file)

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Check file size
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB",
        )

    # Generate storage path
    user_id = get_user_id(x_user_id)
    storage_filename = generate_storage_filename(file.filename)
    storage_path = f"{user_id}/{storage_filename}"

    try:
        if USE_LOCAL_STORAGE:
            # Local storage mode - use thread pool for file operations
            user_dir = get_local_storage_path(user_id)
            local_file_path = user_dir / storage_filename

            # Write file in thread pool to avoid blocking
            await asyncio.to_thread(_write_file_sync, local_file_path, content)

            print(f"[LocalStorage] File saved to: {local_file_path}")

            # In local mode, use virtual path /home/user/data/{filename}
            # The executor._rewrite_paths() will convert this to actual local path
            sandbox_path = f"/home/user/data/{storage_filename}"
        else:
            # Supabase storage mode (async)
            supabase = await get_supabase_client()

            # Determine content type
            ext = os.path.splitext(file.filename)[1].lower()
            content_types = {
                ".csv": "text/csv",
                ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xls": "application/vnd.ms-excel",
                ".dta": "application/octet-stream",
                ".sav": "application/octet-stream",
                ".parquet": "application/octet-stream",
            }
            content_type = content_types.get(ext, "application/octet-stream")

            # Upload file (async)
            await supabase.storage.from_(BUCKET_NAME).upload(
                path=storage_path,
                file=content,
                file_options={"content-type": content_type},
            )

            # In E2B mode, sandbox_path uses the virtual path convention
            sandbox_path = f"/home/user/data/{storage_filename}"

        return UploadResponse(
            success=True,
            filename=storage_filename,
            original_filename=file.filename,
            storage_path=storage_path,
            sandbox_path=sandbox_path,
            size=file_size,
            message="File uploaded successfully",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get("/files/list", response_model=FileListResponse)
async def list_files(x_user_id: Optional[str] = Header(None)):
    """List all files uploaded by the user."""
    user_id = get_user_id(x_user_id)

    try:
        files = []

        if USE_LOCAL_STORAGE:
            # Local storage mode - use thread pool for file operations
            user_dir = get_local_storage_path(user_id)
            file_list = await asyncio.to_thread(_list_files_sync, user_dir)

            for item in file_list:
                # Parse original filename from storage filename
                parts = item["name"].split("_", 3)
                original_name = parts[3] if len(parts) > 3 else item["name"]

                files.append(FileInfo(
                    filename=item["name"],
                    original_filename=original_name,
                    storage_path=f"{user_id}/{item['name']}",
                    size=item["size"],
                    created_at=datetime.fromtimestamp(item["ctime"]).isoformat(),
                ))
        else:
            # Supabase storage mode (async)
            supabase = await get_supabase_client()
            result = await supabase.storage.from_(BUCKET_NAME).list(path=user_id)

            for item in result:
                if item.get("name"):
                    parts = item["name"].split("_", 3)
                    original_name = parts[3] if len(parts) > 3 else item["name"]

                    files.append(FileInfo(
                        filename=item["name"],
                        original_filename=original_name,
                        storage_path=f"{user_id}/{item['name']}",
                        size=item.get("metadata", {}).get("size", 0),
                        created_at=item.get("created_at", ""),
                    ))

        return FileListResponse(files=files, total=len(files))

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")


@app.delete("/files/{filename}", response_model=DeleteResponse)
async def delete_file(filename: str, x_user_id: Optional[str] = Header(None)):
    """Delete a file from storage."""
    user_id = get_user_id(x_user_id)
    storage_path = f"{user_id}/{filename}"

    try:
        if USE_LOCAL_STORAGE:
            # Local storage mode - use thread pool for file operations
            user_dir = get_local_storage_path(user_id)
            local_file_path = user_dir / filename
            await asyncio.to_thread(_delete_file_sync, local_file_path)
        else:
            # Supabase storage mode (async)
            supabase = await get_supabase_client()
            await supabase.storage.from_(BUCKET_NAME).remove([storage_path])

        return DeleteResponse(success=True, message="File deleted successfully")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


@app.get("/files/download-url/{filename}", response_model=DownloadUrlResponse)
async def get_download_url(
    filename: str,
    x_user_id: Optional[str] = Header(None),
    expires_in: int = 3600,
):
    """
    Get a download URL for a file.

    For local storage: returns a file:// URL (for development only)
    For Supabase: returns a signed URL
    """
    user_id = get_user_id(x_user_id)
    storage_path = f"{user_id}/{filename}"

    try:
        if USE_LOCAL_STORAGE:
            # Local storage mode - return file path
            user_dir = get_local_storage_path(user_id)
            local_file_path = user_dir / filename
            return DownloadUrlResponse(
                url=f"file://{local_file_path}",
                expires_in=expires_in,
            )
        else:
            # Supabase storage mode (async)
            supabase = await get_supabase_client()
            result = await supabase.storage.from_(BUCKET_NAME).create_signed_url(
                path=storage_path,
                expires_in=expires_in,
            )
            return DownloadUrlResponse(url=result["signedURL"], expires_in=expires_in)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create download URL: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "data-analyst-file-api"}


# =============================================================================
# Image Serving Routes
# =============================================================================

@app.options("/images/{image_id}")
async def image_options(image_id: str):
    """Handle CORS preflight for image endpoints."""
    return Response(
        content="",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
        },
    )


@app.get("/images/{image_id}")
async def serve_image(
    image_id: str,
    sig: str = Query(..., description="URL signature for verification"),
):
    """
    Serve an image by its ID.

    This endpoint verifies the URL signature before serving the image.
    Images are stored either locally (development) or in Supabase Storage (production).

    Security:
    - URL signature verification prevents unauthorized access
    - Image IDs are UUID-based to prevent enumeration
    - TTL-based cleanup removes old images automatically

    Args:
        image_id: Unique image identifier
        sig: HMAC signature for URL verification

    Returns:
        Image bytes with PNG content type

    Raises:
        403: Invalid signature
        404: Image not found
    """
    # Verify URL signature
    storage = get_image_storage()

    if not storage.verify_signature(image_id, sig):
        raise HTTPException(
            status_code=403,
            detail="Invalid or expired image URL",
        )

    # Get image data
    image_data = storage.get_image(image_id)

    if image_data is None:
        raise HTTPException(
            status_code=404,
            detail="Image not found or expired",
        )

    # Return image with caching and CORS headers
    return Response(
        content=image_data,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
            "X-Content-Type-Options": "nosniff",
            # Explicit CORS headers for cross-origin fetch/download
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            # Allow download with correct filename
            "Content-Disposition": f"inline; filename=\"figure_{image_id[:8]}.png\"",
        },
    )


@app.delete("/images/{image_id}")
async def delete_image(
    image_id: str,
    sig: str = Query(..., description="URL signature for verification"),
):
    """
    Delete an image by its ID.

    Args:
        image_id: Unique image identifier
        sig: HMAC signature for URL verification

    Returns:
        Success message

    Raises:
        403: Invalid signature
        404: Image not found
    """
    storage = get_image_storage()

    if not storage.verify_signature(image_id, sig):
        raise HTTPException(
            status_code=403,
            detail="Invalid or expired image URL",
        )

    success = storage.delete_image(image_id)

    if not success:
        raise HTTPException(
            status_code=404,
            detail="Image not found",
        )

    return {"success": True, "message": "Image deleted"}


@app.post("/images/cleanup")
async def cleanup_images(max_age_hours: int = 24):
    """
    Clean up old images (admin endpoint).

    This endpoint deletes images older than the specified age.
    Should be called periodically (e.g., via cron job) to prevent storage buildup.

    Args:
        max_age_hours: Maximum age of images to keep (default: 24 hours)

    Returns:
        Number of deleted images
    """
    storage = get_image_storage()
    deleted_count = storage.cleanup_old_images(max_age_hours)

    return {
        "success": True,
        "deleted_count": deleted_count,
        "message": f"Cleaned up {deleted_count} images older than {max_age_hours} hours",
    }


# =============================================================================
# Sandbox File Download Routes
# =============================================================================

@app.get("/sandbox/files/{filename}")
async def download_sandbox_file(filename: str):
    """
    Download a file from the sandbox data directory.

    This endpoint serves files created by the AI during code execution.
    Files are stored in the local data directory (sandbox).

    Args:
        filename: Name of the file to download

    Returns:
        File content with appropriate content type

    Raises:
        404: File not found
    """
    from fastapi.responses import FileResponse

    # Get the sandbox data directory
    local_file_path = LOCAL_STORAGE_DIR / filename

    # Security check: prevent path traversal
    try:
        # Resolve the path and ensure it's within LOCAL_STORAGE_DIR
        resolved_path = local_file_path.resolve()
        if not str(resolved_path).startswith(str(LOCAL_STORAGE_DIR.resolve())):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=403, detail="Invalid file path")

    if not local_file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    if not local_file_path.is_file():
        raise HTTPException(status_code=400, detail="Not a file")

    # Determine content type based on extension
    ext = local_file_path.suffix.lower()
    content_types = {
        ".csv": "text/csv",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xls": "application/vnd.ms-excel",
        ".json": "application/json",
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".html": "text/html",
        ".parquet": "application/octet-stream",
        ".dta": "application/octet-stream",
        ".sav": "application/octet-stream",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".pdf": "application/pdf",
    }
    media_type = content_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=str(local_file_path),
        filename=filename,
        media_type=media_type,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@app.get("/sandbox/files")
async def list_sandbox_files():
    """
    List all files in the sandbox data directory.

    Returns:
        List of files with their metadata
    """
    files = []

    if LOCAL_STORAGE_DIR.exists():
        for item in LOCAL_STORAGE_DIR.iterdir():
            if item.is_file():
                stat = item.stat()
                files.append({
                    "filename": item.name,
                    "size": stat.st_size,
                    "modified": stat.st_mtime,
                    "download_url": f"/sandbox/files/{item.name}",
                })

    return {"files": files, "total": len(files)}


# =============================================================================
# Generated Files Download Routes (for E2B / Production)
# =============================================================================

@app.options("/generated-files/{file_id:path}")
async def generated_file_options(file_id: str):
    """Handle CORS preflight for generated file endpoints."""
    return Response(
        content="",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
        },
    )


@app.get("/generated-files/{file_id:path}")
async def download_generated_file(
    file_id: str,
    sig: str = Query(..., description="URL signature for verification"),
):
    """
    Download an agent-generated file by its ID.

    This endpoint serves files created by the AI during code execution in E2B sandbox.
    Files are stored either locally (development) or in Supabase Storage (production).

    Security:
    - URL signature verification prevents unauthorized access
    - File IDs include user and timestamp info

    Args:
        file_id: Unique file identifier (format: user_id/timestamp_random_filename)
        sig: HMAC signature for URL verification

    Returns:
        File content with appropriate content type

    Raises:
        403: Invalid signature
        404: File not found
    """
    # Verify URL signature
    storage = get_file_storage()

    if not storage.verify_signature(file_id, sig):
        raise HTTPException(
            status_code=403,
            detail="Invalid or expired file URL",
        )

    # Get file data
    file_data = storage.get_file(file_id)

    if file_data is None:
        raise HTTPException(
            status_code=404,
            detail="File not found or expired",
        )

    # Extract filename from file_id for Content-Disposition
    # file_id format: user_id/timestamp_random_filename
    parts = file_id.split("/")
    if len(parts) >= 2:
        # Get the part after user_id/
        name_part = parts[-1]
        # Split by underscore and get everything after random part
        name_segments = name_part.split("_", 2)
        if len(name_segments) >= 3:
            filename = name_segments[2]
        else:
            filename = name_part
    else:
        filename = file_id

    # Get MIME type
    content_type = get_mime_type(filename)

    # Return file with appropriate headers
    return Response(
        content=file_data,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
            "X-Content-Type-Options": "nosniff",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Expose-Headers": "Content-Disposition",
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@app.get("/generated-files")
async def list_user_generated_files(
    x_user_id: Optional[str] = Header(None),
):
    """
    List all generated files for a user.

    Returns:
        List of files with metadata and download URLs
    """
    user_id = get_user_id(x_user_id)
    files = list_generated_files(user_id)

    return {
        "files": files,
        "total": len(files),
    }


@app.post("/generated-files/cleanup")
async def cleanup_generated_files(max_age_hours: int = 72):
    """
    Clean up old generated files (admin endpoint).

    Args:
        max_age_hours: Maximum age of files to keep (default: 72 hours)

    Returns:
        Number of deleted files
    """
    storage = get_file_storage()
    deleted_count = storage.cleanup_old_files(max_age_hours)

    return {
        "success": True,
        "deleted_count": deleted_count,
        "message": f"Cleaned up {deleted_count} files older than {max_age_hours} hours",
    }
