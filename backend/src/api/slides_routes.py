"""Slides generation and persistence routes."""

import asyncio
import base64
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from ..agent.graph import get_model
from ..identity import get_persistent_user
from ..storage.supabase_db import USE_SUPABASE_DB, get_supabase_client
from ..usage_limits import enforce_usage_limit, usage_concurrency
from .auth import get_current_user
from .ratelimit import limiter

slides_router = APIRouter(prefix="/api/slides", tags=["slides"])

LOCAL_STORE = Path(".local/slide_presentations.json")


class SlidesLLMRequest(BaseModel):
    model_id: str | None = None
    system: str = Field(min_length=1, max_length=20_000)
    prompt: str = Field(min_length=1, max_length=20_000)
    temperature: float = 0.7
    attachments: list["SlideAttachment"] = Field(default_factory=list, max_length=5)


class SlideAttachment(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(default="application/octet-stream", max_length=120)
    data: str = Field(min_length=1, max_length=1_500_000)


class SlidesLLMResponse(BaseModel):
    text: str


class PresentationPayload(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str | None = None
    topic: str
    slides: list[dict[str, Any]]
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    style: dict[str, Any] | None = None
    preset_id: str | None = None


class PresentationRecord(PresentationPayload):
    user_id: str
    created_at: str | None = None
    updated_at: str | None = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_user_id(user: dict | None) -> str:
    user_id = (user or {}).get("id") or (user or {}).get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="Authenticated identity is missing")
    return user_id


def _extract_attachment_text(attachment: SlideAttachment) -> str:
    """Extract bounded textual context from common slide source formats."""
    try:
        raw = base64.b64decode(attachment.data, validate=True)
    except (ValueError, TypeError):
        return ""

    mime_type = attachment.mime_type.lower()
    if mime_type.startswith("text/") or mime_type in {
        "application/json",
        "application/csv",
        "application/xml",
        "application/markdown",
    }:
        return raw.decode("utf-8", errors="replace")[:20_000]

    if mime_type == "application/pdf":
        try:
            import fitz

            document = fitz.open(stream=raw, filetype="pdf")
            try:
                return "\n".join(page.get_text() for page in document[:5])[:20_000]
            finally:
                document.close()
        except Exception:
            return ""

    return ""


def build_attachment_context(attachments: list[SlideAttachment]) -> str:
    sections = []
    for attachment in attachments:
        text = _extract_attachment_text(attachment).strip()
        if text:
            sections.append(f"Source file: {attachment.name}\n{text}")
    return "\n\n".join(sections)


def _load_local_store() -> dict[str, Any]:
    if not LOCAL_STORE.exists():
        return {}
    return json.loads(LOCAL_STORE.read_text(encoding="utf-8"))


def _save_local_store(data: dict[str, Any]) -> None:
    LOCAL_STORE.parent.mkdir(parents=True, exist_ok=True)
    LOCAL_STORE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


async def _save_presentation(record: PresentationRecord) -> PresentationRecord:
    payload = record.model_dump()
    if USE_SUPABASE_DB:
        try:
            supabase = await get_supabase_client()
            if supabase:
                existing = await _find_presentation(record.id)
                if existing:
                    result = (
                        await supabase.table("slide_presentations")
                        .update(payload)
                        .eq("id", record.id)
                        .eq("user_id", record.user_id)
                        .execute()
                    )
                else:
                    result = await supabase.table("slide_presentations").insert(payload).execute()
                if result.data:
                    return PresentationRecord(**result.data[0])
        except Exception as exc:
            print(f"[Slides] Supabase save failed; using local storage: {exc}")

    store = _load_local_store()
    existing = store.get(record.id, {})
    if existing and existing.get("user_id") != record.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to overwrite this presentation")
    payload["created_at"] = existing.get("created_at") or record.created_at or _now()
    payload["updated_at"] = _now()
    store[record.id] = payload
    _save_local_store(store)
    return PresentationRecord(**payload)


async def _find_presentation(presentation_id: str) -> PresentationRecord | None:
    if USE_SUPABASE_DB:
        try:
            supabase = await get_supabase_client()
            if supabase:
                result = (
                    await supabase.table("slide_presentations")
                    .select("*")
                    .eq("id", presentation_id)
                    .limit(1)
                    .execute()
                )
                if result.data:
                    return PresentationRecord(**result.data[0])
        except Exception as exc:
            print(f"[Slides] Supabase lookup failed; using local storage: {exc}")

    item = _load_local_store().get(presentation_id)
    return PresentationRecord(**item) if item else None


@slides_router.post("/generate", response_model=SlidesLLMResponse)
@limiter.limit("30/minute")
async def generate_slides_text(
    request: Request,
    response: Response,
    payload: SlidesLLMRequest,
    user: dict = Depends(get_current_user),
):
    await enforce_usage_limit("model", user["sub"], request=request)
    try:
        model = get_model(payload.model_id or "deepseek")
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Selected model is not configured: {exc}"
        ) from exc

    try:
        async with usage_concurrency("model", user["sub"]):
            attachment_context = build_attachment_context(payload.attachments)
            prompt = payload.prompt
            if attachment_context:
                prompt = f"{prompt}\n\nUse the following source material when it is relevant:\n{attachment_context}"

            response = await asyncio.wait_for(
                model.ainvoke(
                    [
                        SystemMessage(content=payload.system),
                        HumanMessage(content=prompt),
                    ]
                ),
                timeout=90,
            )
    except asyncio.TimeoutError as exc:
        raise HTTPException(status_code=504, detail="Slides generation timed out") from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Slides generation failed: {exc}") from exc

    content = getattr(response, "content", "")
    if isinstance(content, list):
        content = "".join(
            part.get("text", "") if isinstance(part, dict) else str(part) for part in content
        )
    return SlidesLLMResponse(text=str(content).strip())


@slides_router.post("/presentations", response_model=PresentationRecord)
async def save_presentation(
    payload: PresentationPayload, user: dict = Depends(get_persistent_user)
):
    now = _now()
    user_id = _default_user_id(user)
    existing = await _find_presentation(payload.id)
    if existing and existing.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to overwrite this presentation")

    record_data = payload.model_dump()
    record_data["title"] = payload.title or payload.topic or "Untitled"
    record = PresentationRecord(
        **record_data,
        user_id=user_id,
        created_at=now,
        updated_at=now,
    )
    return await _save_presentation(record)


@slides_router.get("/presentations", response_model=list[PresentationRecord])
async def list_presentations(user: dict = Depends(get_persistent_user)):
    user_id = _default_user_id(user)
    if USE_SUPABASE_DB:
        try:
            supabase = await get_supabase_client()
            if supabase:
                result = (
                    await supabase.table("slide_presentations")
                    .select("*")
                    .eq("user_id", user_id)
                    .order("updated_at", desc=True)
                    .execute()
                )
                return [PresentationRecord(**item) for item in (result.data or [])]
        except Exception as exc:
            print(f"[Slides] Supabase list failed; using local storage: {exc}")

    records = [
        PresentationRecord(**item)
        for item in _load_local_store().values()
        if item.get("user_id") == user_id
    ]
    return sorted(records, key=lambda item: item.updated_at or "", reverse=True)


@slides_router.get("/presentations/{presentation_id}", response_model=PresentationRecord)
async def get_presentation(presentation_id: str, user: dict = Depends(get_persistent_user)):
    presentation = await _find_presentation(presentation_id)
    if not presentation or presentation.user_id != _default_user_id(user):
        raise HTTPException(status_code=404, detail="Presentation not found")
    return presentation


@slides_router.delete("/presentations/{presentation_id}")
async def delete_presentation(presentation_id: str, user: dict = Depends(get_persistent_user)):
    user_id = _default_user_id(user)
    presentation = await _find_presentation(presentation_id)
    if not presentation or presentation.user_id != user_id:
        raise HTTPException(status_code=404, detail="Presentation not found")

    if USE_SUPABASE_DB:
        try:
            supabase = await get_supabase_client()
            if supabase:
                await (
                    supabase.table("slide_presentations")
                    .delete()
                    .eq("id", presentation_id)
                    .eq("user_id", user_id)
                    .execute()
                )
                return {"ok": True}
        except Exception as exc:
            print(f"[Slides] Supabase delete failed; using local storage: {exc}")

    store = _load_local_store()
    store.pop(presentation_id, None)
    _save_local_store(store)
    return {"ok": True}
