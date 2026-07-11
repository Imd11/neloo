"""
Resume Parsing API Routes

Provides endpoints for PDF resume parsing using YOLOv10 layout detection.
"""

from typing import Any, Dict

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from src.resume import parse_resume

from .auth import get_current_user

router = APIRouter(prefix="/api/resume", tags=["resume"])


@router.post("/parse")
async def parse_resume_endpoint(
    file: UploadFile = File(..., description="PDF resume file to parse"),
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Parse a resume PDF file using YOLOv10 layout detection and LLM extraction.

    - **file**: PDF file to parse (max 10MB)

    Returns structured resume data compatible with the resume builder frontend.
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Read file content
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    # Parse resume
    try:
        result = await parse_resume(content, file.filename)
        return {"success": True, "data": result, "filename": file.filename}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Resume parse error: {e}")
        raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")
