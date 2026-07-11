"""
Resume AI API Routes

Provides endpoints for AI-powered resume optimization.
Uses the configured Neloo chat model through the backend registry.
"""

import asyncio
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from typing import List, Optional

from .auth import get_current_user
from .ratelimit import limiter
from ..usage_limits import enforce_usage_limit

router = APIRouter(prefix="/api/resume", tags=["resume-ai"])

def get_model():
    """Load the configured default chat model only when resume AI needs it."""
    from ..agent.graph import get_model as get_configured_model

    return get_configured_model()


class ChatMessage(BaseModel):
    role: str  # "system" | "user" | "assistant"
    content: str = Field(max_length=20_000)


class OptimizeRequest(BaseModel):
    messages: List[ChatMessage] = Field(max_length=40)
    system_prompt: Optional[str] = Field(default=None, max_length=20_000)
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

    Runs resume optimization with the configured default chat model.
    """
    user_id = user.get("sub") or user.get("id")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="Authenticated identity is missing")
    await enforce_usage_limit("model", user_id, request=request)
    try:
        model = get_model()
        system_prompt = payload.system_prompt or RESUME_SYSTEM_PROMPT
        messages = [SystemMessage(content=system_prompt)]
        for message in payload.messages:
            if message.role == "assistant":
                messages.append(AIMessage(content=message.content))
            elif message.role == "system":
                messages.append(SystemMessage(content=message.content))
            else:
                messages.append(HumanMessage(content=message.content))
        model_response = await asyncio.wait_for(model.ainvoke(messages), timeout=60)
        content = getattr(model_response, "content", "")
        if isinstance(content, list):
            content = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in content
            )
        return OptimizeResponse(content=str(content).strip(), success=True)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Resume optimization timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
