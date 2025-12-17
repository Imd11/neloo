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
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# =============================================================================
# Configuration
# =============================================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
BUCKET_NAME = "data-analyst-files"

# Check if we're using local storage mode
USE_LOCAL_STORAGE = not (SUPABASE_URL and SUPABASE_SERVICE_KEY)

# Local storage directory - use the sandbox data directory for simplicity
# This way uploaded files are directly available to the sandbox executor
LOCAL_STORAGE_DIR = Path(tempfile.gettempdir()) / "data-analyst-sandbox" / "data"
LOCAL_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

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

def get_supabase_client():
    """Get Supabase client instance (only when Supabase is configured)."""
    if USE_LOCAL_STORAGE:
        return None
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_local_storage_path(user_id: str) -> Path:
    """Get local storage path for a user.

    In local mode, files are stored directly in LOCAL_STORAGE_DIR (sandbox data dir)
    without user subdirectories for simplicity.
    """
    # In local mode, we store files directly in the sandbox data directory
    # No user subdirectory needed since it's for local development
    LOCAL_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    return LOCAL_STORAGE_DIR


# =============================================================================
# Response Models
# =============================================================================

class UploadResponse(BaseModel):
    """Response model for file upload."""
    success: bool
    filename: str
    original_filename: str
    storage_path: str
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
            # Local storage mode
            user_dir = get_local_storage_path(user_id)
            local_file_path = user_dir / storage_filename

            with open(local_file_path, "wb") as f:
                f.write(content)

            print(f"[LocalStorage] File saved to: {local_file_path}")
        else:
            # Supabase storage mode
            supabase = get_supabase_client()

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

            # Upload file
            supabase.storage.from_(BUCKET_NAME).upload(
                path=storage_path,
                file=content,
                file_options={"content-type": content_type},
            )

        return UploadResponse(
            success=True,
            filename=storage_filename,
            original_filename=file.filename,
            storage_path=storage_path,
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
            # Local storage mode
            user_dir = get_local_storage_path(user_id)
            for item in user_dir.iterdir():
                if item.is_file():
                    # Parse original filename from storage filename
                    parts = item.name.split("_", 3)
                    original_name = parts[3] if len(parts) > 3 else item.name

                    stat = item.stat()
                    files.append(FileInfo(
                        filename=item.name,
                        original_filename=original_name,
                        storage_path=f"{user_id}/{item.name}",
                        size=stat.st_size,
                        created_at=datetime.fromtimestamp(stat.st_ctime).isoformat(),
                    ))
        else:
            # Supabase storage mode
            supabase = get_supabase_client()
            result = supabase.storage.from_(BUCKET_NAME).list(path=user_id)

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
            # Local storage mode
            user_dir = get_local_storage_path(user_id)
            local_file_path = user_dir / filename
            if local_file_path.exists():
                local_file_path.unlink()
        else:
            # Supabase storage mode
            supabase = get_supabase_client()
            supabase.storage.from_(BUCKET_NAME).remove([storage_path])

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
            # Supabase storage mode
            supabase = get_supabase_client()
            result = supabase.storage.from_(BUCKET_NAME).create_signed_url(
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
