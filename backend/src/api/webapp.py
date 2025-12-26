import os
import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import logging
import asyncio

from src.storage.supabase_storage import (
    upload_file_to_storage,
    download_file_from_storage,
    list_user_files,
    delete_file_from_storage,
    USE_SUPABASE_STORAGE,
)
from src.storage.supabase_db import (
    save_file_record,
    get_files_by_type,
    delete_file_record,
    create_thread,
    get_user_threads,
    update_thread_title,
    USE_SUPABASE_DB,
)
from src.auth.supabase_auth import verify_token, get_user_id as auth_get_user_id

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Models
# ============================================================================

class UploadResponse(BaseModel):
    file_id: str
    filename: str
    storage_path: str
    size: int
    content_type: str

class FileInfo(BaseModel):
    id: str
    filename: str
    storage_path: str
    size: int
    content_type: str
    created_at: str
    file_type: str

class CreateThreadRequest(BaseModel):
    langgraph_thread_id: str
    title: str = "New Task"

class UpdateThreadTitleRequest(BaseModel):
    langgraph_thread_id: str
    title: str

# ============================================================================
# Authentication
# ============================================================================

async def get_current_user(authorization: Optional[str] = Header(None)):
    """
    Verify JWT token from Authorization header and return user info.
    Raises HTTPException if token is invalid or missing.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    # Extract token from "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    token = parts[1]
    user = verify_token(token)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return user

# ============================================================================
# Health Check
# ============================================================================

@app.get("/")
async def root():
    return {"message": "Data Analyst API", "status": "running"}

@app.get("/ok")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "ok"}

# ============================================================================
# Environment Info (for debugging)
# ============================================================================

@app.get("/env")
async def get_env_info():
    """Return environment configuration status."""
    return {
        "supabase_storage_enabled": USE_SUPABASE_STORAGE,
        "supabase_db_enabled": USE_SUPABASE_DB,
    }

# ============================================================================
# File Storage API
# ============================================================================

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


@app.post("/files/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Upload a file to Supabase Storage and save metadata to DB.
    
    Requires: Authorization header with valid JWT token
    """
    try:
        # Get user ID from authenticated user
        user_id = auth_get_user_id(user)
        
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        # Read file content
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty file")
        
        content_type = file.content_type or "application/octet-stream"
        
        # Generate unique storage filename
        storage_filename = generate_storage_filename(file.filename)
        storage_path = f"{user_id}/{storage_filename}"
        
        # Upload to Supabase Storage
        if not USE_SUPABASE_STORAGE:
            raise HTTPException(
                status_code=503,
                detail="File storage not configured"
            )
        
        upload_result = await upload_file_to_storage(
            storage_path=storage_path,
            file_content=content,
            content_type=content_type,
        )
        
        if not upload_result:
            raise HTTPException(
                status_code=500,
                detail="Failed to upload file to storage"
            )
        
        # Save file record to database
        file_record = None
        if USE_SUPABASE_DB:
            file_record = await save_file_record(
                user_id=user_id,
                filename=file.filename,
                storage_path=storage_path,
                file_size=len(content),
                content_type=content_type,
                file_type="uploaded",
            )
        
        file_id = file_record["id"] if file_record else storage_path
        
        return UploadResponse(
            file_id=file_id,
            filename=file.filename,
            storage_path=storage_path,
            size=len(content),
            content_type=content_type,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/files/download/{file_id}")
async def download_file(
    file_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Download a file from Supabase Storage.
    
    Requires: Authorization header with valid JWT token
    """
    try:
        user_id = auth_get_user_id(user)
        
        # Get file record from DB to get storage_path
        if USE_SUPABASE_DB:
            files = await get_files_by_type(user_id=user_id)
            file_record = next((f for f in files if f["id"] == file_id), None)
            if not file_record:
                raise HTTPException(status_code=404, detail="File not found")
            storage_path = file_record["storage_path"]
            filename = file_record["filename"]
            content_type = file_record["content_type"]
        else:
            # Legacy: file_id is the storage_path
            storage_path = file_id
            filename = os.path.basename(storage_path)
            content_type = "application/octet-stream"
        
        # Download from Supabase Storage
        file_content = await download_file_from_storage(storage_path)
        if not file_content:
            raise HTTPException(status_code=404, detail="File not found in storage")
        
        return StreamingResponse(
            iter([file_content]),
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Download error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/files/list", response_model=List[FileInfo])
async def list_files(
    user: dict = Depends(get_current_user),
    file_type: Optional[str] = None,
):
    """
    List all files for the authenticated user.
    
    Requires: Authorization header with valid JWT token
    """
    try:
        user_id = auth_get_user_id(user)
        
        if USE_SUPABASE_DB:
            files = await get_files_by_type(
                user_id=user_id,
                file_type=file_type,
            )
            return [
                FileInfo(
                    id=f["id"],
                    filename=f["filename"],
                    storage_path=f["storage_path"],
                    size=f["file_size"],
                    content_type=f["content_type"],
                    created_at=f["created_at"],
                    file_type=f["file_type"],
                )
                for f in files
            ]
        else:
            # Legacy: List from storage directly
            storage_files = await list_user_files(user_id)
            return [
                FileInfo(
                    id=f["name"],
                    filename=os.path.basename(f["name"]),
                    storage_path=f["name"],
                    size=f.get("metadata", {}).get("size", 0),
                    content_type=f.get("metadata", {}).get("mimetype", "application/octet-stream"),
                    created_at=f.get("created_at", ""),
                    file_type="uploaded",
                )
                for f in storage_files
            ]
        
    except Exception as e:
        logger.error(f"List files error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Delete a file from both storage and database.
    
    Requires: Authorization header with valid JWT token
    """
    try:
        user_id = auth_get_user_id(user)
        
        # Get file record to get storage_path
        if USE_SUPABASE_DB:
            files = await get_files_by_type(user_id=user_id)
            file_record = next((f for f in files if f["id"] == file_id), None)
            if not file_record:
                raise HTTPException(status_code=404, detail="File not found")
            storage_path = file_record["storage_path"]
        else:
            storage_path = file_id
        
        # Delete from storage
        if USE_SUPABASE_STORAGE:
            await delete_file_from_storage(storage_path)
        
        # Delete from DB
        if USE_SUPABASE_DB:
            await delete_file_record(file_id, user_id)
        
        return {"message": "File deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete file error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# Thread Management API
# ============================================================================

@app.post("/api/threads")
async def create_thread_endpoint(
    request: CreateThreadRequest,
    user: dict = Depends(get_current_user),
):
    """
    Create a thread record in the database.
    
    Requires: Authorization header with valid JWT token
    """
    try:
        user_id = auth_get_user_id(user)
        
        if not USE_SUPABASE_DB:
            raise HTTPException(
                status_code=503,
                detail="Thread storage not configured"
            )
        
        thread = await create_thread(
            user_id=user_id,
            langgraph_thread_id=request.langgraph_thread_id,
            title=request.title,
        )
        
        if not thread:
            raise HTTPException(
                status_code=500,
                detail="Failed to create thread"
            )
        
        return thread
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create thread error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/threads")
async def list_threads(
    user: dict = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
):
    """
    List threads for the authenticated user.
    
    Requires: Authorization header with valid JWT token
    """
    try:
        user_id = auth_get_user_id(user)
        
        if not USE_SUPABASE_DB:
            return []
        
        threads = await get_user_threads(
            user_id=user_id,
            limit=limit,
            offset=offset,
        )
        
        return threads
        
    except Exception as e:
        logger.error(f"List threads error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/threads")
async def update_thread(
    request: UpdateThreadTitleRequest,
    user: dict = Depends(get_current_user),
):
    """
    Update a thread's title.
    
    Requires: Authorization header with valid JWT token
    """
    try:
        if not USE_SUPABASE_DB:
            raise HTTPException(
                status_code=503,
                detail="Thread storage not configured"
            )
        
        success = await update_thread_title(
            langgraph_thread_id=request.langgraph_thread_id,
            title=request.title,
        )
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to update thread"
            )
        
        return {"message": "Thread updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update thread error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
