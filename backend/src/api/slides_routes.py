"""Slides generation and persistence routes."""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from .auth import get_current_user
from ..agent.graph import get_model
from ..storage.supabase_db import USE_SUPABASE_DB, get_supabase_client

slides_router = APIRouter(prefix="/api/slides", tags=["slides"])

LOCAL_STORE = Path(".local/slide_presentations.json")


class SlidesLLMRequest(BaseModel):
    model_id: str | None = None
    system: str
    prompt: str
    temperature: float = 0.7


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
    user_id: str = "default"
    created_at: str | None = None
    updated_at: str | None = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_user_id(user: dict | None) -> str:
    return str((user or {}).get("id") or "default")


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
        supabase = await get_supabase_client()
        if supabase:
            result = await supabase.table("slide_presentations").upsert(payload, on_conflict="id").execute()
            if result.data:
                return PresentationRecord(**result.data[0])

    store = _load_local_store()
    existing = store.get(record.id, {})
    payload["created_at"] = existing.get("created_at") or record.created_at or _now()
    payload["updated_at"] = _now()
    store[record.id] = payload
    _save_local_store(store)
    return PresentationRecord(**payload)


@slides_router.post("/generate", response_model=SlidesLLMResponse)
async def generate_slides_text(request: SlidesLLMRequest, user: dict = Depends(get_current_user)):
    try:
        model = get_model(request.model_id or "deepseek")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Selected model is not configured: {exc}") from exc

    try:
        response = await asyncio.wait_for(
            model.ainvoke([
                SystemMessage(content=request.system),
                HumanMessage(content=request.prompt),
            ]),
            timeout=90,
        )
    except asyncio.TimeoutError as exc:
        raise HTTPException(status_code=504, detail="Slides generation timed out") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Slides generation failed: {exc}") from exc

    content = getattr(response, "content", "")
    if isinstance(content, list):
        content = "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        )
    return SlidesLLMResponse(text=str(content).strip())


@slides_router.post("/presentations", response_model=PresentationRecord)
async def save_presentation(payload: PresentationPayload, user: dict = Depends(get_current_user)):
    now = _now()
    record = PresentationRecord(
        **payload.model_dump(),
        user_id=_default_user_id(user),
        title=payload.title or payload.topic or "Untitled",
        created_at=now,
        updated_at=now,
    )
    return await _save_presentation(record)


@slides_router.get("/presentations", response_model=list[PresentationRecord])
async def list_presentations(user: dict = Depends(get_current_user)):
    user_id = _default_user_id(user)
    if USE_SUPABASE_DB:
        supabase = await get_supabase_client()
        if supabase:
            result = await supabase.table("slide_presentations").select("*").eq("user_id", user_id).order("updated_at", desc=True).execute()
            return [PresentationRecord(**item) for item in (result.data or [])]

    records = [
        PresentationRecord(**item)
        for item in _load_local_store().values()
        if item.get("user_id") == user_id
    ]
    return sorted(records, key=lambda item: item.updated_at or "", reverse=True)


@slides_router.get("/presentations/{presentation_id}", response_model=PresentationRecord)
async def get_presentation(presentation_id: str, user: dict = Depends(get_current_user)):
    if USE_SUPABASE_DB:
        supabase = await get_supabase_client()
        if supabase:
            result = await supabase.table("slide_presentations").select("*").eq("id", presentation_id).limit(1).execute()
            if result.data:
                return PresentationRecord(**result.data[0])

    item = _load_local_store().get(presentation_id)
    if not item:
        raise HTTPException(status_code=404, detail="Presentation not found")
    return PresentationRecord(**item)


@slides_router.delete("/presentations/{presentation_id}")
async def delete_presentation(presentation_id: str, user: dict = Depends(get_current_user)):
    if USE_SUPABASE_DB:
        supabase = await get_supabase_client()
        if supabase:
            await supabase.table("slide_presentations").delete().eq("id", presentation_id).execute()
            return {"ok": True}

    store = _load_local_store()
    store.pop(presentation_id, None)
    _save_local_store(store)
    return {"ok": True}
