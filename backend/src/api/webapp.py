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

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Query, Depends, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, RedirectResponse
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
    get_user_files,
    get_thread_files,
    get_file_by_id,
    count_file_thread_links,
    delete_file_record,
    delete_thread_file_link,
    delete_thread_record,
    create_thread,
    get_user_threads,
    get_thread_by_langgraph_id,
    update_thread_title,
    USE_SUPABASE_DB,
    FileType,
    # Upload session management
    create_upload_session,
    get_upload_session,
    update_upload_session_status,
    commit_upload_session,
    get_user_pending_uploads,
    cleanup_expired_uploads,
    # Chat message persistence
    save_chat_message,
    get_chat_messages,
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
ALLOWED_EXTENSIONS = {
    # Data files
    ".csv", ".xlsx", ".xls", ".dta", ".sav", ".parquet",
    # Image files (for multimodal)
    ".png", ".jpg", ".jpeg", ".gif", ".webp",
}

# Maximum file size (100 MB)
MAX_FILE_SIZE = 100 * 1024 * 1024

# Upload session TTL (1 hour)
UPLOAD_SESSION_TTL_SECONDS = 3600

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
# Two-Phase Upload Models (Staging Area Pattern)
# =============================================================================

class UploadInitRequest(BaseModel):
    """Request model for initializing an upload session."""
    filename: str
    size: int  # Expected file size in bytes


class UploadInitResponse(BaseModel):
    """Response model for upload initialization."""
    file_id: str
    upload_url: str  # URL to upload the file to
    ttl: int  # Time to live in seconds
    expires_at: str  # ISO timestamp when session expires


class UploadCompleteRequest(BaseModel):
    """Request model for completing an upload."""
    file_id: str


class UploadCompleteResponse(BaseModel):
    """Response model for upload completion."""
    file_id: str
    status: str  # 'uploaded' or 'error'
    filename: str
    size: int
    sandbox_path: str


class CommitFilesRequest(BaseModel):
    """Request model for committing files to a thread."""
    file_ids: list[str]
    thread_id: str  # LangGraph thread ID


class ImportFromLibraryRequest(BaseModel):
    """Request model for importing files from library."""
    file_ids: list[str]  # IDs of files in the library to import


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
    langgraph_thread_id: Optional[str] = Form(None),
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
                # Ensure thread record exists if the upload is associated with a thread.
                # We bind uploads to the current conversation by linking to thread_files.
                if langgraph_thread_id:
                    await create_thread(
                        user_id=user_id,
                        langgraph_thread_id=langgraph_thread_id,
                        title="New Task",
                    )

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
                    thread_id=langgraph_thread_id,  # Treat as langgraph_thread_id for association
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


# =============================================================================
# Two-Phase Upload API (Staging Area Pattern)
# =============================================================================
#
# This implements the industry best practice for file uploads:
# 1. POST /uploads/init - Initialize upload session (returns file_id + upload_url)
# 2. POST /uploads/{file_id}/data - Upload the actual file data
# 3. POST /uploads/{file_id}/complete - Mark upload as complete (optional explicit call)
# 4. POST /uploads/commit - Commit files to a thread when sending message
#
# Files are staged in user's space (bound to user_id from JWT, NOT thread_id).
# They're only associated with a thread when the message is sent.
# TTL cleanup removes uncommitted files after expiration.


@app.post("/uploads/init", response_model=UploadInitResponse)
async def init_upload(
    data: UploadInitRequest,
    user: dict = Depends(get_current_user),
):
    """
    Initialize an upload session.

    This is the first step of the two-phase upload process.
    Creates a staging record and returns the file_id and upload URL.

    The upload is bound to the authenticated user (from JWT), NOT a thread.
    Thread association happens later when the message is sent.
    """
    user_id = auth_get_user_id(user)

    # Validate filename extension
    ext = os.path.splitext(data.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Check file size
    if data.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB",
        )

    # Generate unique file ID and storage path
    file_id = str(uuid.uuid4())
    storage_filename = generate_storage_filename(data.filename)
    storage_path = f"{user_id}/{storage_filename}"

    print(f"[Upload/Init] ========== UPLOAD DEBUG ==========")
    print(f"[Upload/Init] user_id = '{user_id}'")
    print(f"[Upload/Init] filename = '{data.filename}'")
    print(f"[Upload/Init] storage_path = '{storage_path}'")
    print(f"[Upload/Init] bucket = '{BUCKET_NAME}'")

    # Calculate expiration
    from datetime import timedelta
    expires_at = datetime.now() + timedelta(seconds=UPLOAD_SESSION_TTL_SECONDS)

    # Create upload session in database
    if USE_SUPABASE_DB:
        session = await create_upload_session(
            user_id=user_id,
            file_id=file_id,
            filename=data.filename,
            expected_size=data.size,
            storage_path=storage_path,
            ttl_seconds=UPLOAD_SESSION_TTL_SECONDS,
        )
        if not session:
            raise HTTPException(status_code=500, detail="Failed to create upload session")

    # The upload URL points to our own endpoint
    upload_url = f"/uploads/{file_id}/data"

    return UploadInitResponse(
        file_id=file_id,
        upload_url=upload_url,
        ttl=UPLOAD_SESSION_TTL_SECONDS,
        expires_at=expires_at.isoformat(),
    )


@app.post("/uploads/{file_id}/data", response_model=UploadCompleteResponse)
async def upload_file_data(
    file_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Upload the actual file data.

    This is the second step of the two-phase upload process.
    Receives the file content and stores it, then marks the session as uploaded.
    """
    user_id = auth_get_user_id(user)

    # Verify the upload session exists and belongs to this user
    session = await get_upload_session(file_id, user_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Upload session not found or expired",
        )

    if session["status"] != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Upload session already in status: {session['status']}",
        )

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Check file size
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB",
        )

    storage_path = session["storage_path"]
    storage_filename = os.path.basename(storage_path)

    try:
        if USE_LOCAL_STORAGE:
            # Local storage mode
            user_dir = get_local_storage_path(user_id)
            local_file_path = user_dir / storage_filename
            await asyncio.to_thread(_write_file_sync, local_file_path, content)
            sandbox_path = f"/home/user/data/{storage_filename}"
        else:
            # Supabase storage mode
            supabase = await get_supabase_client()
            ext = os.path.splitext(session["filename"])[1].lower()
            content_types = {
                ".csv": "text/csv",
                ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xls": "application/vnd.ms-excel",
                ".dta": "application/octet-stream",
                ".sav": "application/octet-stream",
                ".parquet": "application/octet-stream",
            }
            content_type = content_types.get(ext, "application/octet-stream")

            print(f"[Upload/Data] ========== STORAGE UPLOAD DEBUG ==========")
            print(f"[Upload/Data] Uploading to bucket='{BUCKET_NAME}', path='{storage_path}'")
            print(f"[Upload/Data] File size: {len(content)} bytes, content_type: {content_type}")

            await supabase.storage.from_(BUCKET_NAME).upload(
                path=storage_path,
                file=content,
                file_options={"content-type": content_type},
            )
            print(f"[Upload/Data] SUCCESS: File uploaded to Supabase Storage")
            sandbox_path = f"/home/user/data/{storage_filename}"

        # Update session status to uploaded
        await update_upload_session_status(file_id, "uploaded", actual_size=file_size)

        return UploadCompleteResponse(
            file_id=file_id,
            status="uploaded",
            filename=session["filename"],
            size=file_size,
            sandbox_path=sandbox_path,
        )

    except Exception as e:
        # Mark session as error
        await update_upload_session_status(file_id, "error")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.post("/uploads/commit")
async def commit_uploads(
    data: CommitFilesRequest,
    user: dict = Depends(get_current_user),
):
    """
    Commit uploaded files to a thread.

    This is called when a message is sent. It associates the staged files
    with the thread and creates proper file records.
    """
    user_id = auth_get_user_id(user)
    committed_files = []
    errors = []

    # Ensure thread exists once (the per-file loop is for file-level validation/commit).
    # If the LangGraph thread ID is already associated with a different user, block the commit.
    existing_thread = await get_thread_by_langgraph_id(data.thread_id) if USE_SUPABASE_DB else None
    if existing_thread and existing_thread.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to use this thread")

    await create_thread(
        user_id=user_id,
        langgraph_thread_id=data.thread_id,
        title="New Task",
    )

    for file_id in data.file_ids:
        # Verify session exists and is uploaded
        session = await get_upload_session(file_id, user_id)
        if not session:
            errors.append({"file_id": file_id, "error": "Session not found or expired"})
            continue

        if session["status"] != "uploaded":
            errors.append({"file_id": file_id, "error": f"Invalid status: {session['status']}"})
            continue

        # Create file record in files table
        if USE_SUPABASE_DB:
            from ..storage.supabase_db import save_file_record
            ext = os.path.splitext(session["filename"])[1].lower()
            content_types = {
                ".csv": "text/csv",
                ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xls": "application/vnd.ms-excel",
                ".dta": "application/octet-stream",
                ".sav": "application/octet-stream",
                ".parquet": "application/octet-stream",
            }
            content_type = content_types.get(ext, "application/octet-stream")

            await save_file_record(
                user_id=user_id,
                filename=session["filename"],
                storage_path=session["storage_path"],
                file_size=session.get("actual_size") or session["expected_size"],
                content_type=content_type,
                file_type="uploaded",
                file_id=file_id,
                thread_id=data.thread_id,
            )

        # Mark session as committed
        await commit_upload_session(file_id, data.thread_id)

        storage_filename = os.path.basename(session["storage_path"])
        committed_files.append({
            "file_id": file_id,
            "filename": session["filename"],
            "storage_path": session["storage_path"],
            "sandbox_path": f"/home/user/data/{storage_filename}",
        })

    return {
        "success": len(errors) == 0,
        "committed": committed_files,
        "errors": errors,
        "thread_id": data.thread_id,
    }


@app.post("/uploads/import-from-library")
async def import_from_library(
    data: ImportFromLibraryRequest,
    user: dict = Depends(get_current_user),
):
    """
    Import files from the user's library to be used in a new message.

    This creates staged file entries that can be committed with the message.
    Unlike regular uploads, these files already exist in storage, so we just
    create upload session records pointing to them.
    """
    user_id = auth_get_user_id(user)
    imported_files = []
    errors = []

    for file_id in data.file_ids:
        try:
            # Get the file from the library
            file_record = await get_file_by_id(file_id)
            if not file_record:
                errors.append({"file_id": file_id, "error": "File not found"})
                continue

            # Verify ownership
            if file_record.get("user_id") != user_id:
                errors.append({"file_id": file_id, "error": "Not authorized"})
                continue

            # Get file details
            filename = file_record.get("original_filename") or file_record.get("filename", "unknown")
            storage_path = file_record.get("storage_path", "")
            # DB column is file_size, not size
            file_size = file_record.get("file_size") or file_record.get("size") or 0

            # Create a new upload session that references the existing file
            # Generate a new ID for this import session
            import_session_id = str(uuid.uuid4())

            # Create session with storage_path already set (file exists)
            await create_upload_session(
                file_id=import_session_id,
                user_id=user_id,
                filename=filename,
                expected_size=file_size,
                storage_path=storage_path,
            )

            # Mark as uploaded immediately since file already exists
            await update_upload_session_status(
                file_id=import_session_id,
                status="uploaded",
                actual_size=file_size,
            )

            # Get the sandbox path
            storage_filename = os.path.basename(storage_path) if storage_path else filename
            sandbox_path = f"/home/user/data/{storage_filename}"

            imported_files.append({
                "file_id": import_session_id,
                "original_file_id": file_id,
                "filename": filename,
                "size": file_size,
                "storage_path": storage_path,
                "sandbox_path": sandbox_path,
            })

        except Exception as e:
            errors.append({"file_id": file_id, "error": str(e)})

    return {
        "success": len(errors) == 0,
        "imported": imported_files,
        "errors": errors,
    }


@app.get("/uploads/pending")
async def get_pending_uploads(user: dict = Depends(get_current_user)):
    """
    Get all pending uploads for the current user.

    Returns files that have been uploaded but not yet committed to a thread.
    """
    user_id = auth_get_user_id(user)
    pending = await get_user_pending_uploads(user_id)

    return {
        "pending": [
            {
                "file_id": p["id"],
                "filename": p["filename"],
                "status": p["status"],
                "size": p.get("actual_size") or p["expected_size"],
                "expires_at": p["expires_at"],
            }
            for p in pending
        ],
        "total": len(pending),
    }


@app.delete("/uploads/{file_id}")
async def cancel_upload(
    file_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Cancel a pending upload.

    Removes the staged file and deletes the session record.
    """
    user_id = auth_get_user_id(user)

    session = await get_upload_session(file_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")

    if session["committed"]:
        raise HTTPException(status_code=400, detail="Cannot cancel committed upload")

    # Delete the file from storage if it was uploaded
    if session["status"] == "uploaded":
        storage_path = session["storage_path"]
        try:
            if USE_LOCAL_STORAGE:
                storage_filename = os.path.basename(storage_path)
                user_dir = get_local_storage_path(user_id)
                local_file_path = user_dir / storage_filename
                await asyncio.to_thread(_delete_file_sync, local_file_path)
            else:
                supabase = await get_supabase_client()
                await supabase.storage.from_(BUCKET_NAME).remove([storage_path])
        except Exception as e:
            print(f"Warning: Failed to delete staged file: {e}")

    # Delete the session record
    if USE_SUPABASE_DB:
        supabase = await get_supabase_client()
        await supabase.table("upload_sessions").delete().eq("id", file_id).execute()

    return {"success": True, "message": "Upload cancelled"}


@app.post("/uploads/cleanup")
async def cleanup_uploads():
    """
    Clean up expired upload sessions (admin endpoint).

    Deletes expired sessions and their associated files.
    Should be called periodically via cron job.
    """
    deleted_count = await cleanup_expired_uploads()

    # TODO: Also clean up orphaned files in storage

    return {
        "success": True,
        "deleted_sessions": deleted_count,
        "message": f"Cleaned up {deleted_count} expired upload sessions",
    }


# =============================================================================
# File Preview API (for Agent Context Injection)
# =============================================================================
#
# This endpoint provides data previews that can be embedded directly in the
# Agent's context window, similar to how Gemini/ChatGPT handle file uploads.
# Instead of just passing file paths, the agent can now "see" the actual data.
#

class FilePreviewResponse(BaseModel):
    """Response model for file preview."""
    file_id: str
    filename: str
    preview: str  # Human-readable preview (first N rows as markdown/text)
    row_count: int  # Total rows in file (if applicable)
    column_count: int  # Total columns (if applicable)
    columns: list[str]  # Column names
    truncated: bool  # Whether preview is truncated
    file_size: int
    preview_rows: int  # Number of rows in preview


@app.get("/files/{file_id}/preview", response_model=FilePreviewResponse)
async def get_file_preview(
    file_id: str,
    max_rows: int = Query(10, ge=1, le=100, description="Maximum rows to include in preview"),
    user: dict = Depends(get_current_user),
):
    """
    Get a preview of a file's content for Agent context injection.

    This endpoint reads the file and returns a structured preview that can be
    embedded directly in the Agent's context window. This allows the Agent to
    "see" the data immediately, similar to Gemini/ChatGPT.

    Supported formats: CSV, Excel, Parquet, DTA, SAV

    Args:
        file_id: The upload session file ID
        max_rows: Maximum number of rows to include (default: 10, max: 100)

    Returns:
        FilePreviewResponse with preview data as markdown table
    """
    user_id = auth_get_user_id(user)

    # Get upload session to find the file
    session = await get_upload_session(file_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="File not found")

    if session["status"] not in ("uploaded", "committed"):
        raise HTTPException(status_code=400, detail="File not yet uploaded")

    storage_path = session["storage_path"]
    filename = session["filename"]
    ext = os.path.splitext(filename)[1].lower()

    try:
        # Read file content from storage
        if USE_LOCAL_STORAGE:
            storage_filename = os.path.basename(storage_path)
            user_dir = get_local_storage_path(user_id)
            local_file_path = user_dir / storage_filename

            def _read_file_sync():
                with open(local_file_path, "rb") as f:
                    return f.read()

            file_content = await asyncio.to_thread(_read_file_sync)
        else:
            supabase = await get_supabase_client()
            result = await supabase.storage.from_(BUCKET_NAME).download(storage_path)
            file_content = result

        file_size = len(file_content)

        # Parse file based on extension
        import io
        import pandas as pd

        if ext == ".csv":
            df = pd.read_csv(io.BytesIO(file_content), nrows=max_rows + 1)
        elif ext in (".xlsx", ".xls"):
            df = pd.read_excel(io.BytesIO(file_content), nrows=max_rows + 1)
        elif ext == ".parquet":
            import pyarrow.parquet as pq
            table = pq.read_table(io.BytesIO(file_content))
            df = table.to_pandas().head(max_rows + 1)
        elif ext == ".dta":
            df = pd.read_stata(io.BytesIO(file_content))
            df = df.head(max_rows + 1)
        elif ext == ".sav":
            import pyreadstat
            df, meta = pyreadstat.read_sav(io.BytesIO(file_content))
            df = df.head(max_rows + 1)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

        # Check if truncated
        truncated = len(df) > max_rows
        if truncated:
            df = df.head(max_rows)

        # Get total row count (approximate for large files)
        total_rows = len(df)
        if ext == ".csv":
            # For CSV, count newlines for approximate total
            try:
                full_df = pd.read_csv(io.BytesIO(file_content))
                total_rows = len(full_df)
            except Exception:
                pass

        # Generate markdown preview
        columns = df.columns.tolist()
        preview_md = df.to_markdown(index=False)

        return FilePreviewResponse(
            file_id=file_id,
            filename=filename,
            preview=preview_md,
            row_count=total_rows,
            column_count=len(columns),
            columns=columns,
            truncated=truncated,
            file_size=file_size,
            preview_rows=len(df),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {str(e)}")


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
# Model Configuration Routes
# =============================================================================

class ModelInfo(BaseModel):
    """Model information for frontend display."""
    id: str
    display_name: str
    available: bool


class ModelsResponse(BaseModel):
    """Response for available models list."""
    models: list[ModelInfo]
    default_model: str | None


@app.get("/api/models", response_model=ModelsResponse)
async def get_available_models():
    """
    Get list of available language models.

    Returns models that have their API keys configured.
    Frontend uses this to populate the model selector dropdown.
    """
    from ..agent.graph import get_available_models as get_models, get_default_model_id

    models = get_models()
    default_model = get_default_model_id()

    return ModelsResponse(
        models=[ModelInfo(**m) for m in models],
        default_model=default_model,
    )


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
                original_filename=f.get("original_filename") or f.get("filename"),
                file_type=f.get("file_type", "generated"),
                storage_path=f.get("storage_path"),
                download_url=f.get("download_url") or f"/api/files/{f.get('id','')}/download",
                size=f.get("file_size"),
                mime_type=f.get("content_type"),
                created_at=f.get("created_at", ""),
            ))

        return DatabaseFileListResponse(
            files=files,
            total=len(files),
            file_type=file_type,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get files: {str(e)}")


@app.get("/api/threads/{langgraph_thread_id}/files", response_model=DatabaseFileListResponse)
async def get_thread_files_api(
    langgraph_thread_id: str,
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
        thread_record = await get_thread_by_langgraph_id(langgraph_thread_id)
        if not thread_record:
            return DatabaseFileListResponse(files=[], total=0, file_type=file_type)
        if thread_record["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")

        # Query database for thread files using DB thread UUID
        files_data = await get_thread_files(thread_id=thread_record["id"])

        # Optional filter by file_type
        if file_type:
            files_data = [f for f in files_data if f.get("file_type") == file_type]

        # Convert to response format
        files = []
        for f in files_data:
            files.append(DatabaseFileInfo(
                id=f.get("id", ""),
                filename=f.get("filename", ""),
                original_filename=f.get("original_filename") or f.get("filename"),
                file_type=f.get("file_type", "generated"),
                storage_path=f.get("storage_path"),
                download_url=f.get("download_url") or f"/api/files/{f.get('id','')}/download",
                size=f.get("file_size"),
                mime_type=f.get("content_type"),
                created_at=f.get("created_at", ""),
            ))

        return DatabaseFileListResponse(
            files=files,
            total=len(files),
            file_type=file_type,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get thread files: {str(e)}")


@app.get("/api/files", response_model=DatabaseFileListResponse)
async def list_files_api(
    types: Optional[str] = Query(None, description="Comma-separated file types to include"),
    user: dict = Depends(get_current_user),
):
    """List user's files from the database (DB-driven library)."""
    user_id = auth_get_user_id(user)
    if not USE_SUPABASE_DB:
        return DatabaseFileListResponse(files=[], total=0, file_type=None)
    file_types: Optional[list[FileType]] = None
    if types:
        requested = [t.strip() for t in types.split(",") if t.strip()]
        file_types = [t for t in requested if t in ("uploaded", "generated", "chart", "code")]  # type: ignore
    files_data = await get_user_files(user_id=user_id, file_types=file_types)
    files: list[DatabaseFileInfo] = []
    for f in files_data:
        files.append(DatabaseFileInfo(
            id=f.get("id", ""),
            filename=f.get("filename", ""),
            original_filename=f.get("original_filename") or f.get("filename"),
            file_type=f.get("file_type", "generated"),
            storage_path=f.get("storage_path"),
            download_url=f.get("download_url") or f"/api/files/{f.get('id','')}/download",
            size=f.get("file_size"),
            mime_type=f.get("content_type"),
            created_at=f.get("created_at", ""),
        ))
    return DatabaseFileListResponse(files=files, total=len(files))


@app.get("/api/files/{file_id}/usage-count")
async def get_file_usage_count_api(
    file_id: str,
    user: dict = Depends(get_current_user),
):
    user_id = auth_get_user_id(user)
    if not USE_SUPABASE_DB:
        return {"count": 0}
    count = await count_file_thread_links(file_id=file_id, user_id=user_id)
    return {"count": count}


@app.delete("/api/threads/{langgraph_thread_id}/files/{file_id}")
async def unlink_thread_file_api(
    langgraph_thread_id: str,
    file_id: str,
    user: dict = Depends(get_current_user),
):
    """Remove a file association from a thread (local delete)."""
    user_id = auth_get_user_id(user)
    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")
    thread_record = await get_thread_by_langgraph_id(langgraph_thread_id)
    if not thread_record:
        raise HTTPException(status_code=404, detail="Thread not found")
    if thread_record["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    await delete_thread_file_link(thread_db_id=thread_record["id"], file_id=file_id)
    return {"success": True}


@app.delete("/api/files/{file_id}")
async def delete_file_global_api(
    file_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a file globally: remove from storage + delete DB record (cascades thread_files)."""
    user_id = auth_get_user_id(user)
    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")
    record = await get_file_by_id(file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    if record.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    bucket = record.get("bucket")
    storage_path = record.get("storage_path")
    file_type = record.get("file_type")
    if not bucket:
        if file_type == "uploaded":
            bucket = BUCKET_NAME
        elif file_type in ("generated", "code"):
            bucket = "data-analyst-generated"
        elif file_type == "chart":
            bucket = "data-analyst-images"

    # Best-effort storage delete; DB delete is the source of truth.
    try:
        if not USE_LOCAL_STORAGE and storage_path and bucket:
            supabase = await get_supabase_client()
            if supabase:
                await supabase.storage.from_(bucket).remove([storage_path])
    except Exception:
        pass

    deleted = await delete_file_record(file_id=file_id, user_id=user_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete file record")
    return {"success": True}


@app.get("/api/files/{file_id}/download")
async def download_file_api(
    file_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Authenticated download endpoint (fixed URL stored in DB).
    This endpoint can redirect to a signed URL for Supabase Storage.
    """
    user_id = auth_get_user_id(user)
    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")
    record = await get_file_by_id(file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    if record.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    bucket = record.get("bucket")
    storage_path = record.get("storage_path")
    file_type = record.get("file_type")
    if not bucket:
        if file_type == "uploaded":
            bucket = BUCKET_NAME
        elif file_type in ("generated", "code"):
            bucket = "data-analyst-generated"
        elif file_type == "chart":
            bucket = "data-analyst-images"

    if USE_LOCAL_STORAGE:
        raise HTTPException(status_code=501, detail="Local download not implemented for DB mode")

    supabase = await get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Storage not configured")

    if not storage_path or not bucket:
        raise HTTPException(status_code=500, detail="Missing storage metadata")

    result = await supabase.storage.from_(bucket).create_signed_url(
        path=storage_path,
        expires_in=3600,
    )
    signed = result.get("signedURL") or result.get("signedUrl")
    if not signed:
        raise HTTPException(status_code=500, detail="Failed to create download URL")
    return RedirectResponse(url=signed, status_code=307)


# =============================================================================
# Thread Management Routes
# =============================================================================

class ThreadCreate(BaseModel):
    """Request model for creating a thread."""
    langgraph_thread_id: str
    title: str = "New Task"
    mode: str = "default"  # "default" or "web-dev"


class ThreadInfo(BaseModel):
    """Thread information response model."""
    id: str
    user_id: str
    title: str
    langgraph_thread_id: str
    mode: str = "default"  # "default" or "web-dev"
    model_id: Optional[str] = None  # Per-thread model preference
    created_at: str
    updated_at: str


class ThreadListResponse(BaseModel):
    """Response model for thread list."""
    threads: list[ThreadInfo]
    total: int


class ThreadUpdateRequest(BaseModel):
    """Request model for updating thread."""
    title: Optional[str] = None
    model_id: Optional[str] = None  # Per-thread model preference


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
        data: Thread creation data (langgraph_thread_id, title, mode)
        user: Authenticated user

    Returns:
        Created thread record
    """
    user_id = auth_get_user_id(user)

    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        # If the thread already exists, only the owner can reuse it.
        existing = await get_thread_by_langgraph_id(data.langgraph_thread_id)
        if existing:
            if existing.get("user_id") != user_id:
                raise HTTPException(status_code=403, detail="Not authorized")
            thread_record = existing
        else:
            thread_record = await create_thread(
                user_id=user_id,
                langgraph_thread_id=data.langgraph_thread_id,
                title=data.title,
                mode=data.mode,
            )

        if not thread_record:
            raise HTTPException(status_code=500, detail="Failed to create thread")

        return ThreadInfo(
            id=thread_record["id"],
            user_id=thread_record["user_id"],
            title=thread_record["title"],
            langgraph_thread_id=thread_record["langgraph_thread_id"],
            mode=thread_record.get("mode", "default"),
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
                mode=t.get("mode", "default"),
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
            mode=thread_record.get("mode", "default"),
            model_id=thread_record.get("model_id"),
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

        # Update model_id if provided (for per-thread model preference)
        if data.model_id is not None:
            from ..storage.supabase_db import update_thread_model_id
            success = await update_thread_model_id(langgraph_thread_id, data.model_id)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to update thread model")

        # Fetch updated record
        updated_record = await get_thread_by_langgraph_id(langgraph_thread_id)

        return ThreadInfo(
            id=updated_record["id"],
            user_id=updated_record["user_id"],
            title=updated_record["title"],
            langgraph_thread_id=updated_record["langgraph_thread_id"],
            mode=updated_record.get("mode", "default"),
            model_id=updated_record.get("model_id"),
            created_at=updated_record["created_at"],
            updated_at=updated_record["updated_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update thread: {str(e)}")


@app.delete("/api/threads/{langgraph_thread_id}")
async def delete_thread_api(
    langgraph_thread_id: str,
    delete_orphan_files: bool = Query(False, description="If true, also delete files only used by this thread"),
    user: dict = Depends(get_current_user),
):
    """
    Delete a thread owned by the current user.

    Default behavior deletes only the thread record (and cascaded thread_files), and does NOT delete files/storage
    because files may be reused across threads.
    """
    user_id = auth_get_user_id(user)
    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")

    thread_record = await get_thread_by_langgraph_id(langgraph_thread_id)
    if not thread_record:
        raise HTTPException(status_code=404, detail="Thread not found")
    if thread_record.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    thread_db_id = thread_record["id"]

    files_snapshot: list[dict] = []
    if delete_orphan_files:
        files_snapshot = await get_thread_files(thread_id=thread_db_id)

    deleted = await delete_thread_record(thread_db_id=thread_db_id, user_id=user_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete thread")

    if delete_orphan_files and files_snapshot:
        supabase = await get_supabase_client()
        for f in files_snapshot:
            file_id = f.get("id")
            if not file_id:
                continue
            if f.get("user_id") != user_id:
                continue
            if await count_file_thread_links(file_id=file_id, user_id=user_id) != 0:
                continue

            bucket = f.get("bucket")
            storage_path = f.get("storage_path")
            file_type = f.get("file_type")
            if not bucket:
                if file_type == "uploaded":
                    bucket = BUCKET_NAME
                elif file_type in ("generated", "code"):
                    bucket = "data-analyst-generated"
                elif file_type == "chart":
                    bucket = "data-analyst-images"

            try:
                if not USE_LOCAL_STORAGE and storage_path and bucket and supabase:
                    await supabase.storage.from_(bucket).remove([storage_path])
            except Exception:
                pass

            await delete_file_record(file_id=file_id, user_id=user_id)

    return {"success": True}


# =============================================================================
# AI-Generated Thread Title
# =============================================================================

class GenerateTitleRequest(BaseModel):
    """Request model for generating thread title."""
    user_message: str  # The user's first message to generate title from


class GenerateTitleResponse(BaseModel):
    """Response model for generated title."""
    title: str
    generated: bool


async def _generate_title_with_llm(user_message: str) -> str:
    """
    Use LLM to generate a concise title from the user's message.

    Falls back to truncating the message if LLM fails.
    """
    try:
        from langchain.chat_models import init_chat_model

        # Use a fast, cheap model for title generation
        if os.environ.get("DEEPSEEK_API_KEY"):
            model = init_chat_model(
                "deepseek-chat",
                model_provider="deepseek",
                api_key=os.environ.get("DEEPSEEK_API_KEY"),
                timeout=30,
            )
        elif os.environ.get("ANTHROPIC_API_KEY"):
            model = init_chat_model(
                "claude-3-5-haiku-latest",
                model_provider="anthropic",
                api_key=os.environ.get("ANTHROPIC_API_KEY"),
                base_url=os.environ.get("ANTHROPIC_BASE_URL"),
                timeout=30,
            )
        elif os.environ.get("OPENAI_API_KEY"):
            model = init_chat_model(
                "gpt-4o-mini",
                model_provider="openai",
                api_key=os.environ.get("OPENAI_API_KEY"),
                timeout=30,
            )
        else:
            # No LLM available, fallback to truncation
            return _truncate_message(user_message)

        # Generate title
        from langchain_core.messages import SystemMessage, HumanMessage

        response = await model.ainvoke([
            SystemMessage(content="""Generate a concise but descriptive title (7-15 Chinese characters or 5-8 English words) for this conversation.

Rules:
- Include both the action AND the subject/topic
- Be specific enough to distinguish from other conversations
- Use the same language as the user's message
- Do NOT use quotes or punctuation
- Just output the title, nothing else

Examples:
- "帮我分析这个销售数据" → "销售数据趋势分析与洞察"
- "Analyze my sales data" → "Sales Data Trend Analysis"
- "帮我写一个Python爬虫" → "Python网页爬虫开发"
- "Write a React component for login" → "React Login Component Development"
- "解释一下量子计算的原理" → "量子计算原理详解"
- "帮我翻译这篇文章" → "文章翻译与润色"
"""),
            HumanMessage(content=user_message),
        ])

        title = response.content.strip()
        # Clean up: remove quotes if present
        title = title.strip('"\'')
        # Limit length
        if len(title) > 50:
            title = title[:47] + "..."

        return title if title else _truncate_message(user_message)

    except Exception as e:
        print(f"[GenerateTitle] LLM failed: {e}, falling back to truncation")
        return _truncate_message(user_message)


def _truncate_message(message: str) -> str:
    """Truncate message to create a simple title."""
    # Remove newlines and extra spaces
    clean = " ".join(message.split())
    if len(clean) <= 20:
        return clean
    return clean[:17] + "..."


@app.post("/api/threads/{langgraph_thread_id}/generate-title", response_model=GenerateTitleResponse)
async def generate_thread_title_api(
    langgraph_thread_id: str,
    data: GenerateTitleRequest,
    user: dict = Depends(get_current_user),
):
    """
    Generate and update thread title using AI.

    This endpoint uses LLM to generate a concise, descriptive title
    based on the user's first message, then updates the thread.

    Args:
        langgraph_thread_id: The LangGraph thread ID
        data: Contains user_message to generate title from
        user: Authenticated user

    Returns:
        Generated title and whether it was applied
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

        # Only generate if title is still default
        current_title = thread_record.get("title", "")
        normalized = current_title.strip().lower() if current_title else ""
        if normalized and normalized not in {"new task", "新任务"}:
            # Title already customized, don't overwrite
            return GenerateTitleResponse(title=current_title, generated=False)

        # Generate title using LLM
        new_title = await _generate_title_with_llm(data.user_message)

        # Update thread title
        success = await update_thread_title(langgraph_thread_id, new_title)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to update thread title")

        return GenerateTitleResponse(title=new_title, generated=True)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate title: {str(e)}")


# =============================================================================
# Suggested Follow-up Questions
# =============================================================================

class SuggestedQuestionsRequest(BaseModel):
    """Request model for generating suggested questions."""
    ai_response: str
    conversation_context: Optional[str] = None


class SuggestedQuestionsResponse(BaseModel):
    """Response model for suggested questions."""
    questions: list[str]


async def _generate_suggested_questions(ai_response: str, context: str = "") -> list[str]:
    """
    Use LLM to generate 3 suggested follow-up questions based on AI response.
    
    Returns a list of 3 questions, or empty list on failure.
    """
    try:
        from langchain.chat_models import init_chat_model
        from langchain_core.messages import SystemMessage, HumanMessage

        # Use a fast, cheap model
        if os.environ.get("DEEPSEEK_API_KEY"):
            model = init_chat_model(
                "deepseek-chat",
                model_provider="deepseek",
                api_key=os.environ.get("DEEPSEEK_API_KEY"),
                timeout=30,
            )
        elif os.environ.get("ANTHROPIC_API_KEY"):
            model = init_chat_model(
                "claude-3-5-haiku-latest",
                model_provider="anthropic",
                api_key=os.environ.get("ANTHROPIC_API_KEY"),
                base_url=os.environ.get("ANTHROPIC_BASE_URL"),
                timeout=30,
            )
        elif os.environ.get("OPENAI_API_KEY"):
            model = init_chat_model(
                "gpt-4o-mini",
                model_provider="openai",
                api_key=os.environ.get("OPENAI_API_KEY"),
                timeout=30,
            )
        else:
            return []

        # Truncate context if too long
        max_context = 2000
        truncated_response = ai_response[:max_context] if len(ai_response) > max_context else ai_response

        response = await model.ainvoke([
            SystemMessage(content="""基于AI的回复内容，生成3个用户可能想继续问的后续问题。

规则：
- 问题要与AI回复的内容相关
- 问题要有深度，能够延续对话
- 使用与AI回复相同的语言（中文或英文）
- 每个问题15-40个字符
- 直接输出3个问题，每行一个
- 不要加序号、引号或其他格式

示例输出：
这个方法在大数据量下性能如何？
能否用其他语言实现相同功能？
这种方案的安全性考虑有哪些？"""),
            HumanMessage(content=f"AI回复:\n{truncated_response}"),
        ])

        # Parse response into list of questions
        content = response.content.strip()
        lines = [line.strip() for line in content.split("\n") if line.strip()]
        
        # Take first 3 non-empty lines
        questions = []
        for line in lines:
            # Remove common prefixes like "1.", "-", "•", etc.
            clean = line.lstrip("0123456789.-•·）) ")
            if clean and len(clean) > 5:
                questions.append(clean)
            if len(questions) >= 3:
                break
        
        return questions[:3]

    except Exception as e:
        print(f"[SuggestedQuestions] LLM failed: {e}")
        return []


@app.post("/api/threads/{langgraph_thread_id}/generate-suggestions", response_model=SuggestedQuestionsResponse)
async def generate_suggested_questions_api(
    langgraph_thread_id: str,
    data: SuggestedQuestionsRequest,
    user: dict = Depends(get_current_user),
):
    """
    Generate suggested follow-up questions based on the AI's response.
    
    This endpoint uses LLM to generate 3 relevant follow-up questions
    that the user might want to ask next.
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

        # Generate questions
        questions = await _generate_suggested_questions(
            ai_response=data.ai_response,
            context=data.conversation_context or ""
        )

        return SuggestedQuestionsResponse(questions=questions)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[SuggestedQuestions] Error: {e}")
        # Return empty list on error, don't fail the request
        return SuggestedQuestionsResponse(questions=[])


# =============================================================================
# Share Link Endpoints
# =============================================================================

class ShareResponse(BaseModel):
    """Response model for share link creation."""
    share_id: str
    share_url: str
    created_at: str


class ShareRequest(BaseModel):
    """Request model for share link creation."""
    message_index: Optional[int] = None  # If provided, share only this message pair


class SharedConversationResponse(BaseModel):
    """Response model for viewing a shared conversation."""
    title: str
    messages: list
    shared_at: str
    message_index: Optional[int] = None  # If set, only show this message pair


@app.post("/api/threads/{langgraph_thread_id}/share", response_model=ShareResponse)
async def create_share_link(
    langgraph_thread_id: str,
    request: Request,
    body: Optional[ShareRequest] = None,
    user: dict = Depends(get_current_user),
):
    """
    Create a share link for a thread or a single message.
    Only the thread owner can create share links.
    
    If message_index is provided in the body, only that message pair (user question + AI response) 
    will be visible in the shared link.
    """
    user_id = auth_get_user_id(user)
    
    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    # Verify thread exists and user owns it
    thread_record = await get_thread_by_langgraph_id(langgraph_thread_id)
    if not thread_record:
        raise HTTPException(status_code=404, detail="Thread not found")
    if thread_record.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get message_index from request body if provided
    message_index = body.message_index if body else None
    
    # Create the share
    from ..storage.supabase_db import create_share
    share = await create_share(
        user_id=user_id, 
        thread_id=langgraph_thread_id,
        message_index=message_index,
    )
    
    if not share:
        raise HTTPException(status_code=500, detail="Failed to create share link")
    
    # Build share URL
    # Use request origin or frontend URL
    base_url = str(request.base_url).rstrip("/")
    # For production, use the frontend URL pattern
    share_url = f"{base_url.replace('/api', '')}/share/{share['share_id']}"
    
    return ShareResponse(
        share_id=share["share_id"],
        share_url=share_url,
        created_at=share["created_at"],
    )


@app.get("/api/share/{share_id}", response_model=SharedConversationResponse)
async def get_shared_conversation(share_id: str):
    """
    Get a shared conversation by share ID.
    This endpoint is PUBLIC - no authentication required.
    Returns 404 if the share doesn't exist or the original thread was deleted.
    """
    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    # Get the share record
    from ..storage.supabase_db import get_share_by_id
    share = await get_share_by_id(share_id)
    
    if not share:
        raise HTTPException(status_code=404, detail="分享链接不存在")
    
    # Check if the original thread still exists
    thread_record = await get_thread_by_langgraph_id(share["thread_id"])
    if not thread_record:
        raise HTTPException(status_code=404, detail="该对话已被删除")
    
    # Get messages from LangGraph
    try:
        from langgraph_sdk import get_client
        
        # Use LANGGRAPH_API_URL if set, otherwise use localhost
        # In LangGraph Platform, the server runs on port 2024 by default
        langgraph_url = os.environ.get("LANGGRAPH_API_URL", "http://localhost:2024")
        client = get_client(url=langgraph_url)
        
        # Get thread state which includes messages
        thread_state = await client.threads.get_state(share["thread_id"])
        messages = thread_state.get("values", {}).get("messages", [])
        
        # Convert messages to serializable format
        serialized_messages = []
        for msg in messages:
            if hasattr(msg, "dict"):
                serialized_messages.append(msg.dict())
            elif isinstance(msg, dict):
                serialized_messages.append(msg)
            else:
                serialized_messages.append({"type": "unknown", "content": str(msg)})
        
        return SharedConversationResponse(
            title=thread_record.get("title", "分享的对话"),
            messages=serialized_messages,
            shared_at=share["created_at"],
            message_index=share.get("message_index"),  # For single message sharing
        )
    except Exception as e:
        print(f"[Share] Failed to get messages: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load conversation: {str(e)}")


@app.delete("/api/shares/{share_id}")
async def delete_share_link(
    share_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Delete a share link.
    Only the share owner can delete it.
    """
    user_id = auth_get_user_id(user)
    
    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    from ..storage.supabase_db import delete_share
    success = await delete_share(share_id=share_id, user_id=user_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete share link")
    
    return {"success": True, "message": "Share link deleted"}


# =============================================================================
# Chat History Endpoint (LangGraph SDK Compatibility)
# =============================================================================

@app.get("/threads/{thread_id}/history")
async def get_thread_history(
    thread_id: str,
    user: dict = Depends(get_optional_user),
):
    """
    Get chat history for a thread (LangGraph SDK compatible format).
    
    This endpoint returns messages stored in chat_messages table,
    formatted as ThreadState[] for @langchain/langgraph-sdk compatibility.
    
    Args:
        thread_id: The LangGraph thread ID
        
    Returns:
        ThreadState[] format expected by SDK's fetchHistory()
    """
    # Get messages from database
    messages = await get_chat_messages(thread_id)
    
    if not messages:
        # Return empty history (not 404) for new threads
        return []
    
    # Return in ThreadState[] format expected by LangGraph SDK
    return [{
        "values": {
            "messages": messages
        },
        "next": [],
        "checkpoint": {
            "thread_id": thread_id,
            "checkpoint_ns": "",
            "checkpoint_id": None
        },
        "metadata": {},
        "created_at": None,
        "tasks": []
    }]


@app.post("/threads/{thread_id}/history")
async def post_thread_history(
    thread_id: str,
    user: dict = Depends(get_optional_user),
):
    """
    POST version of history endpoint for SDK compatibility.
    Some SDK codepaths POST to /history.
    """
    return await get_thread_history(thread_id=thread_id, user=user)


# =============================================================================
# Save Message Endpoint (For Frontend to Save After Stream Completes)
# =============================================================================

class SaveMessageRequest(BaseModel):
    """Request body for saving a chat message."""
    message_id: str
    role: str  # 'user' | 'assistant' | 'tool'
    message_data: dict  # Complete message object


@app.post("/api/threads/{thread_id}/messages")
async def save_thread_message(
    thread_id: str,
    request: SaveMessageRequest,
    user: dict = Depends(get_optional_user),
):
    """
    Save a chat message to the database.
    
    This endpoint is called by the frontend after:
    1. User sends a message (save user message)
    2. AI stream completes (save assistant message with final content)
    
    Uses idempotent upsert - safe to call multiple times with same message_id.
    
    Args:
        thread_id: The LangGraph thread ID
        request: Message data including message_id, role, and message_data
        
    Returns:
        Success status
    """
    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    # Validate role
    if request.role not in ('user', 'assistant', 'system', 'tool'):
        raise HTTPException(status_code=400, detail=f"Invalid role: {request.role}")
    
    result = await save_chat_message(
        thread_id=thread_id,
        message_id=request.message_id,
        role=request.role,
        message_data=request.message_data,
    )
    
    if result:
        return {"success": True, "seq": result.get("seq")}
    else:
        raise HTTPException(status_code=500, detail="Failed to save message")


