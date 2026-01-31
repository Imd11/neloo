"""
Translation API Routes
Simple translation endpoint using DeepSeek
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import os
import httpx

from .auth import get_current_user

translate_router = APIRouter(prefix="/api", tags=["translate"])


class TranslateRequest(BaseModel):
    text: str
    target_language: str = "English"


class TranslateResponse(BaseModel):
    translation: str


TRANSLATE_SYSTEM_PROMPT = """You are a professional translation assistant. Detect the source language automatically. Translate the user's text into {target_language}. Preserve tone, meaning, punctuation, emoji, and inline formatting. Return only the translated text without commentary, labels, or quotes."""


@translate_router.post("/translate", response_model=TranslateResponse)
async def translate(request: TranslateRequest, user: dict = Depends(get_current_user)):
    """Translate text using DeepSeek API"""
    
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    # Get DeepSeek API key from environment
    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="Translation service not configured")
    
    # Build the system prompt with target language
    system_prompt = TRANSLATE_SYSTEM_PROMPT.format(target_language=request.target_language)
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": request.text},
                    ],
                    "temperature": 0.3,  # Lower temperature for more consistent translation
                    "max_tokens": 4096,
                },
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=502, detail="Translation service error")
            
            data = response.json()
            translation = data["choices"][0]["message"]["content"].strip()
            
            return TranslateResponse(translation=translation)
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Translation request timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")
