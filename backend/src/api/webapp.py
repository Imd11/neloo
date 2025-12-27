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

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from starlette.responses import StreamingResponse
from pydantic import BaseModel

# Import authentication
from .auth import (
    extract_token_from_header,
    get_current_user,
    get_jwt_secret,
    get_optional_user,
    verify_jwt_token,
    get_user_id as auth_get_user_id,
)
from ..runtime_context import user_id_ctx, thread_id_ctx

# Import image storage
from ..storage import get_image, get_image_storage

# Import generated file storage
from ..storage.file_storage import (
    get_file_storage,
    get_generated_file,
    list_generated_files,
    get_mime_type,
)

# Import database operations for file listing
from ..storage.supabase_db import (
    get_files_by_type,
    get_thread_files,
    create_thread,
    get_user_threads,
    get_thread_by_langgraph_id,
    update_thread_title,
    USE_SUPABASE_DB,
    FileType,
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

# =============================================================================
# Request Context Middleware
# =============================================================================
#
# LangGraph endpoints are served inside this FastAPI app. Tool calls (e.g. execute_python)
# need the authenticated user_id + current thread_id so file syncing targets the correct
# Supabase Storage path and generated artifacts can be associated with the right thread.
#
# IMPORTANT: For streaming responses, ContextVar values must remain set for the entire
# stream iteration; otherwise tool calls during streaming will fall back to defaults.
#


def _extract_thread_id_from_path(path: str) -> str | None:
    parts = [p for p in path.split("/") if p]
    for i, part in enumerate(parts):
        if part == "threads" and i + 1 < len(parts):
            return parts[i + 1]
    return None


@app.middleware("http")
async def _set_runtime_context(request: Request, call_next):
    user_id = "default"
    thread_id = _extract_thread_id_from_path(request.url.path) or "default"

    authorization = request.headers.get("authorization")
    token = extract_token_from_header(authorization)
    if token:
        try:
            payload = verify_jwt_token(token)
            user_id = payload.get("sub", "default")
        except HTTPException:
            pass
    else:
        if not get_jwt_secret():
            user_id = request.headers.get("x-user-id") or "default"
        else:
            user_id = "anonymous"

    user_token = user_id_ctx.set(user_id)
    thread_token = thread_id_ctx.set(thread_id)

    response = await call_next(request)

    if isinstance(response, StreamingResponse):
        original_iterator = response.body_iterator

        async def _wrap_iterator():
            try:
                async for chunk in original_iterator:
                    yield chunk
            finally:
                user_id_ctx.reset(user_token)
                thread_id_ctx.reset(thread_token)

        response.body_iterator = _wrap_iterator()
        return response

    user_id_ctx.reset(user_token)
    thread_id_ctx.reset(thread_token)
    return response

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
    # Sanitize original filename (remove special characters, keep ASCII only)
    base_name = os.path.splitext(original_filename)[0]
    safe_name = "".join(c if (c.isascii() and c.isalnum()) or c in "-_" else "_" for c in base_name)
    safe_name = safe_name[:50]  # Limit length
    return f"{timestamp}_{unique_id}_{safe_name}{ext}"


def get_user_id_from_header(x_user_id: Optional[str]) -> str:
    """Get user ID from header or use default (legacy, for backward compatibility)."""
    return x_user_id or "default"


# =============================================================================
# API Routes
# =============================================================================

@app.post("/files/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Upload a data file.

    Requires authentication. User ID is extracted from JWT token.

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

    # Generate storage path using authenticated user ID
    user_id = auth_get_user_id(user)
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

        # Save file record to database if Supabase DB is enabled
        if USE_SUPABASE_DB:
            try:
                from ..storage.supabase_db import save_file_record

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

                # Save to database (async)
                await save_file_record(
                    user_id=user_id,
                    filename=file.filename,
                    storage_path=storage_path,
                    file_size=file_size,
                    content_type=content_type,
                    file_type="uploaded",
                    thread_id=None,  # Uploaded files don't have thread association yet
                )
                print(f"[Database] File record saved: {file.filename}")
            except Exception as db_error:
                # Log database error but don't fail the upload
                print(f"[Database] Warning: Failed to save file record: {db_error}")

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
async def list_files(user: dict = Depends(get_current_user)):
    """List all files uploaded by the user. Requires authentication."""
    user_id = auth_get_user_id(user)

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
async def delete_file(filename: str, user: dict = Depends(get_current_user)):
    """Delete a file from storage. Requires authentication."""
    user_id = auth_get_user_id(user)
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
    user: dict = Depends(get_current_user),
    expires_in: int = 3600,
):
    """
    Get a download URL for a file. Requires authentication.

    For local storage: returns a file:// URL (for development only)
    For Supabase: returns a signed URL
    """
    user_id = auth_get_user_id(user)
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
    user: dict = Depends(get_current_user),
):
    """
    List all generated files for a user. Requires authentication.

    Returns:
        List of files with metadata and download URLs
    """
    user_id = auth_get_user_id(user)
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


# =============================================================================
# Database-Driven File API Routes (for FilePanel categories)
# =============================================================================

class DatabaseFileInfo(BaseModel):
    """Information about a file from database."""
    id: str
    filename: str
    original_filename: Optional[str] = None
    file_type: str  # 'uploaded', 'generated', 'chart', 'code'
    storage_path: Optional[str] = None
    download_url: Optional[str] = None
    size: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: str


class DatabaseFileListResponse(BaseModel):
    """Response model for database file list."""
    files: list[DatabaseFileInfo]
    total: int
    file_type: Optional[str] = None


@app.get("/api/files/by-type", response_model=DatabaseFileListResponse)
async def get_files_by_type_api(
    file_type: Optional[str] = Query(None, description="Filter by file type: uploaded, generated, chart, code"),
    user: dict = Depends(get_current_user),
):
    """
    Get files from database filtered by type.

    This endpoint queries the files table in Supabase database,
    providing categorized access to all user files.

    File types:
    - uploaded: User-uploaded data files (CSV, Excel, etc.)
    - generated: AI-generated data files (processed datasets, exports)
    - chart: AI-generated charts and visualizations
    - code: Code execution history/snippets

    Args:
        file_type: Optional filter by file type

    Returns:
        List of files with metadata
    """
    user_id = auth_get_user_id(user)

    if not USE_SUPABASE_DB:
        # Fallback: return empty list if database is not configured
        return DatabaseFileListResponse(files=[], total=0, file_type=file_type)

    try:
        # Query database
        files_data = await get_files_by_type(
            user_id=user_id,
            file_type=file_type,  # type: ignore
        )

        # Convert to response format
        files = []
        for f in files_data:
            files.append(DatabaseFileInfo(
                id=f.get("id", ""),
                filename=f.get("filename", ""),
                original_filename=f.get("original_filename"),
                file_type=f.get("file_type", "generated"),
                storage_path=f.get("storage_path"),
                download_url=f.get("download_url"),
                size=f.get("size"),
                mime_type=f.get("mime_type"),
                created_at=f.get("created_at", ""),
            ))

        return DatabaseFileListResponse(
            files=files,
            total=len(files),
            file_type=file_type,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get files: {str(e)}")


@app.get("/api/threads/{thread_id}/files", response_model=DatabaseFileListResponse)
async def get_thread_files_api(
    thread_id: str,
    file_type: Optional[str] = Query(None, description="Optional filter by file type"),
    user: dict = Depends(get_current_user),
):
    """
    Get all files associated with a specific thread.

    This endpoint returns files linked to a conversation thread,
    useful for displaying context-aware file lists in chat UI.

    Args:
        thread_id: The thread/conversation ID
        file_type: Optional filter by file type

    Returns:
        List of files associated with the thread
    """
    user_id = auth_get_user_id(user)

    if not USE_SUPABASE_DB:
        return DatabaseFileListResponse(files=[], total=0, file_type=file_type)

    try:
        # Query database for thread files
        files_data = await get_thread_files(
            thread_id=thread_id,
            file_type=file_type,  # type: ignore
        )

        # Filter by user_id for security (ensure user owns these files)
        # The RLS policy should handle this, but double-check here
        user_files = [f for f in files_data if f.get("user_id") == user_id]

        # Convert to response format
        files = []
        for f in user_files:
            files.append(DatabaseFileInfo(
                id=f.get("id", ""),
                filename=f.get("filename", ""),
                original_filename=f.get("original_filename"),
                file_type=f.get("file_type", "generated"),
                storage_path=f.get("storage_path"),
                download_url=f.get("download_url"),
                size=f.get("size"),
                mime_type=f.get("mime_type"),
                created_at=f.get("created_at", ""),
            ))

        return DatabaseFileListResponse(
            files=files,
            total=len(files),
            file_type=file_type,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get thread files: {str(e)}")


# =============================================================================
# Thread Management Routes
# =============================================================================

class ThreadCreate(BaseModel):
    """Request model for creating a thread."""
    langgraph_thread_id: str
    title: str = "New Task"


class ThreadInfo(BaseModel):
    """Thread information response model."""
    id: str
    user_id: str
    title: str
    langgraph_thread_id: str
    created_at: str
    updated_at: str


class ThreadListResponse(BaseModel):
    """Response model for thread list."""
    threads: list[ThreadInfo]
    total: int


class ThreadUpdateRequest(BaseModel):
    """Request model for updating thread."""
    title: Optional[str] = None


@app.post("/api/threads", response_model=ThreadInfo)
async def create_thread_api(
    data: ThreadCreate,
    user: dict = Depends(get_current_user),
):
    """
    Create a new thread record in the database.

    This endpoint should be called when a new conversation starts.
    It creates the thread record that file associations will reference.

    Args:
        data: Thread creation data (langgraph_thread_id, title)
        user: Authenticated user

    Returns:
        Created thread record
    """
    user_id = auth_get_user_id(user)

    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        thread_record = await create_thread(
            user_id=user_id,
            langgraph_thread_id=data.langgraph_thread_id,
            title=data.title,
        )

        if not thread_record:
            raise HTTPException(status_code=500, detail="Failed to create thread")

        return ThreadInfo(
            id=thread_record["id"],
            user_id=thread_record["user_id"],
            title=thread_record["title"],
            langgraph_thread_id=thread_record["langgraph_thread_id"],
            created_at=thread_record["created_at"],
            updated_at=thread_record["updated_at"],
        )

    except Exception as e:
        # Return more detailed error for debugging
        raise HTTPException(status_code=500, detail=f"Failed to create thread: {str(e)}")


@app.get("/api/threads", response_model=ThreadListResponse)
async def list_threads_api(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
):
    """
    List user's threads.

    Args:
        limit: Maximum number of threads to return
        offset: Offset for pagination
        user: Authenticated user

    Returns:
        List of user's threads
    """
    user_id = auth_get_user_id(user)

    if not USE_SUPABASE_DB:
        return ThreadListResponse(threads=[], total=0)

    try:
        threads_data = await get_user_threads(
            user_id=user_id,
            limit=limit,
            offset=offset,
        )

        threads = []
        for t in threads_data:
            threads.append(ThreadInfo(
                id=t["id"],
                user_id=t["user_id"],
                title=t["title"],
                langgraph_thread_id=t["langgraph_thread_id"],
                created_at=t["created_at"],
                updated_at=t["updated_at"],
            ))

        return ThreadListResponse(
            threads=threads,
            total=len(threads),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list threads: {str(e)}")


@app.get("/api/threads/{langgraph_thread_id}", response_model=ThreadInfo)
async def get_thread_api(
    langgraph_thread_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Get a specific thread by its LangGraph ID.

    Args:
        langgraph_thread_id: The LangGraph thread ID
        user: Authenticated user

    Returns:
        Thread record
    """
    user_id = auth_get_user_id(user)

    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        thread_record = await get_thread_by_langgraph_id(langgraph_thread_id)

        if not thread_record:
            raise HTTPException(status_code=404, detail="Thread not found")

        # Verify ownership
        if thread_record["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")

        return ThreadInfo(
            id=thread_record["id"],
            user_id=thread_record["user_id"],
            title=thread_record["title"],
            langgraph_thread_id=thread_record["langgraph_thread_id"],
            created_at=thread_record["created_at"],
            updated_at=thread_record["updated_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get thread: {str(e)}")


@app.patch("/api/threads/{langgraph_thread_id}", response_model=ThreadInfo)
async def update_thread_api(
    langgraph_thread_id: str,
    data: ThreadUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """
    Update a thread's properties.

    Args:
        langgraph_thread_id: The LangGraph thread ID
        data: Update data (currently only title)
        user: Authenticated user

    Returns:
        Updated thread record
    """
    user_id = auth_get_user_id(user)

    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        # Verify thread exists and user owns it
        thread_record = await get_thread_by_langgraph_id(langgraph_thread_id)

        if not thread_record:
            raise HTTPException(status_code=404, detail="Thread not found")

        if thread_record["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")

        # Update title if provided
        if data.title:
            success = await update_thread_title(langgraph_thread_id, data.title)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to update thread")

        # Fetch updated record
        updated_record = await get_thread_by_langgraph_id(langgraph_thread_id)

        return ThreadInfo(
            id=updated_record["id"],
            user_id=updated_record["user_id"],
            title=updated_record["title"],
            langgraph_thread_id=updated_record["langgraph_thread_id"],
            created_at=updated_record["created_at"],
            updated_at=updated_record["updated_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update thread: {str(e)}")
