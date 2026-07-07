"""
Resume AI API Routes

Provides endpoints for AI-powered resume optimization.
Uses DeepSeek API via backend proxy.
"""

import os
import httpx
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel
from typing import List, Optional

from .auth import get_current_user
from .ratelimit import limiter

router = APIRouter(prefix="/api/resume", tags=["resume-ai"])

# DeepSeek API configuration
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"


class ChatMessage(BaseModel):
    role: str  # "system" | "user" | "assistant"
    content: str


class OptimizeRequest(BaseModel):
    messages: List[ChatMessage]
    system_prompt: Optional[str] = None
    stream: bool = False


class OptimizeResponse(BaseModel):
    content: str
    success: bool = True


# System prompt for resume optimization
RESUME_SYSTEM_PROMPT = """You are a professional resume optimization assistant. Your task is to help users improve their resume content.

Your capabilities include:
1. Improving job descriptions and work-experience wording.
2. Suggesting stronger action verbs and keywords.
3. Providing industry-specific optimization suggestions.
4. Helping shorten overly verbose content.
5. Checking grammar, clarity, and expression.

IMPORTANT: When the user asks you to modify resume content, return a JSON-formatted response.

If the user is only asking a question and no modification is requested, reply normally in plain text.

If the user asks you to modify a field, return JSON in this shape:
```json
{
  "message": "Your reply explaining why this change improves the resume",
  "suggestion": {
    "field": "Field path, such as personal.summary or experience.0.description",
    "before": "Original content",
    "after": "Improved content",
    "reason": "Reason for the change"
  }
}
```

Field path examples:
- personal.name - name
- personal.title - job title
- personal.summary - personal summary
- personal.email - email
- experience.0.description - description of the first work experience entry
- experience.0.position - position in the first work experience entry
- education.0.description - description of the first education entry
- skills.0.name - name of the first skill

Response rules:
- For ordinary conversation, return plain text.
- For modification requests, return JSON containing a suggestion object.
- JSON must be wrapped in a ```json fenced code block."""


@router.post("/optimize")
@limiter.limit("30/minute")
async def optimize_resume(
    request: Request,
    response: Response,
    payload: OptimizeRequest,
    user: dict = Depends(get_current_user),
) -> OptimizeResponse:
    """
    AI-powered resume optimization endpoint.
    
    Proxies requests to DeepSeek API using backend API key.
    """
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    
    if not api_key:
        raise HTTPException(
            status_code=500, 
            detail="DeepSeek API key not configured on server"
        )
    
    # Build messages with system prompt
    system_prompt = payload.system_prompt or RESUME_SYSTEM_PROMPT
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend([{"role": m.role, "content": m.content} for m in payload.messages])
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                DEEPSEEK_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": DEEPSEEK_MODEL,
                    "messages": messages,
                    "stream": False,
                    "temperature": 0.7,
                    "max_tokens": 2000
                }
            )
            
            if response.status_code != 200:
                error_text = response.text
                print(f"❌ DeepSeek API error: {response.status_code} - {error_text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"DeepSeek API error: {error_text}"
                )
            
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            return OptimizeResponse(content=content, success=True)
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="DeepSeek API timeout")
    except Exception as e:
        print(f"❌ Resume optimize error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
