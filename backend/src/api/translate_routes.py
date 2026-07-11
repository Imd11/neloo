"""Translation API routes."""

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from .auth import get_current_user
from .ratelimit import limiter
from ..agent.graph import get_model
from ..usage_limits import enforce_usage_limit

translate_router = APIRouter(prefix="/api", tags=["translate"])


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)
    target_language: str = Field(default="English", max_length=80)
    source_language: str = Field(default="auto", max_length=80)
    style: str = Field(default="general", max_length=40)
    model_id: str | None = None


class TranslateResponse(BaseModel):
    translation: str


STYLE_PROMPTS = {
    "general": "Use natural, fluent wording.",
    "business_email": "Use professional, polite business language and preserve email formatting.",
    "academic": "Use rigorous academic wording and preserve domain-specific terminology.",
    "technical": "Use accurate, concise technical language and keep terminology consistent.",
    "social_media": "Use relaxed, friendly, conversational wording.",
}


def _build_system_prompt(request: TranslateRequest) -> str:
    source_language = (request.source_language or "auto").strip()
    if source_language.lower() == "auto":
        source_rule = "Detect the source language automatically."
    else:
        source_rule = f"The source language is {source_language}."

    style_requirement = STYLE_PROMPTS.get(request.style, STYLE_PROMPTS["general"])
    return f"""You are a professional translation assistant.

{source_rule}
Translate the user's text into {request.target_language}.

Translation style requirement: {style_requirement}

Preserve tone, meaning, punctuation, emoji, and inline formatting. Return only the translated text without commentary, labels, or quotes."""


@translate_router.post("/translate", response_model=TranslateResponse)
@limiter.limit("30/minute")
async def translate(
    request: Request,
    response: Response,
    payload: TranslateRequest,
    user: dict = Depends(get_current_user),
):
    """Translate text with the currently selected model."""

    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    await enforce_usage_limit("model", user["sub"], request=request)

    try:
        model = get_model(payload.model_id or "deepseek")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Selected model is not configured: {exc}") from exc

    try:
        response = await asyncio.wait_for(
            model.ainvoke(
                [
                    SystemMessage(content=_build_system_prompt(payload)),
                    HumanMessage(content=payload.text),
                ]
            ),
            timeout=60,
        )
    except asyncio.TimeoutError as exc:
        raise HTTPException(status_code=504, detail="Translation request timed out") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Translation failed: {exc}") from exc

    content = getattr(response, "content", "")
    if isinstance(content, list):
        content = "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        )

    translation = str(content).strip()
    if not translation:
        raise HTTPException(status_code=502, detail="Translation returned an empty response")
    return TranslateResponse(translation=translation)
