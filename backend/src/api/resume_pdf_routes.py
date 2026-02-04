"""
Resume PDF Export API Routes

Provides endpoint for high-quality PDF generation using Playwright + Chromium.
This generates vector PDFs with selectable text, making them ATS-compatible.
"""

import asyncio
import tempfile
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
import io

router = APIRouter(prefix="/api/resume", tags=["resume-pdf"])


class PDFRequest(BaseModel):
    """Request body for PDF generation"""
    html: str = Field(..., description="Complete HTML document to render", max_length=512000)
    filename: Optional[str] = Field("resume.pdf", description="Output filename")


async def generate_pdf_with_playwright(html: str) -> bytes:
    """
    Generate PDF from HTML using Playwright + Chromium.
    
    Args:
        html: Complete HTML document string
        
    Returns:
        PDF bytes
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        raise HTTPException(
            status_code=500, 
            detail="Playwright not installed. Run: pip install playwright && playwright install chromium"
        )
    
    async with async_playwright() as p:
        # Launch Chromium browser
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ]
        )
        
        try:
            # Create page
            page = await browser.new_page()
            
            # Set content with timeout
            await page.set_content(html, wait_until='networkidle', timeout=15000)
            
            # Wait for fonts to load
            await page.wait_for_timeout(500)
            
            # Generate PDF with A4 size
            pdf_bytes = await page.pdf(
                format='A4',
                print_background=True,
                margin={
                    'top': '0mm',
                    'right': '0mm',
                    'bottom': '0mm',
                    'left': '0mm'
                },
                prefer_css_page_size=True,  # Respect @page CSS rules
            )
            
            return pdf_bytes
            
        finally:
            await browser.close()


@router.post("/pdf")
async def export_pdf(request: PDFRequest) -> StreamingResponse:
    """
    Generate PDF from HTML content.
    
    Uses Playwright + Chromium for high-quality vector PDF rendering.
    The generated PDF has:
    - Selectable text (ATS-compatible)
    - Accurate CSS rendering
    - Professional print quality
    
    Args:
        request: PDFRequest with HTML content and optional filename
        
    Returns:
        PDF file as streaming response
    """
    # Validate HTML size
    if len(request.html) > 500 * 1024:
        raise HTTPException(
            status_code=400, 
            detail="HTML content too large (max 500KB)"
        )
    
    if not request.html.strip():
        raise HTTPException(
            status_code=400,
            detail="HTML content cannot be empty"
        )
    
    try:
        # Generate PDF with timeout
        pdf_bytes = await asyncio.wait_for(
            generate_pdf_with_playwright(request.html),
            timeout=30.0
        )
        
        # Sanitize filename
        filename = request.filename or "resume.pdf"
        if not filename.endswith('.pdf'):
            filename += '.pdf'
        
        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(pdf_bytes)),
            }
        )
        
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="PDF generation timed out (30s limit)"
        )
    except Exception as e:
        print(f"❌ PDF generation error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation failed: {str(e)}"
        )


@router.get("/pdf/health")
async def pdf_health_check():
    """
    Check if PDF generation is available.
    
    Verifies Playwright and Chromium are installed.
    """
    try:
        from playwright.async_api import async_playwright
        
        # Quick check if browser can launch
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            await browser.close()
            
        return {
            "status": "healthy",
            "playwright": "available",
            "chromium": "installed"
        }
    except ImportError:
        return {
            "status": "degraded",
            "playwright": "not installed",
            "chromium": "unknown"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "playwright": "installed",
            "chromium": "error",
            "error": str(e)
        }

