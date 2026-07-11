"""Regression coverage for slide presentation ownership in local storage."""

import asyncio
import base64
import os
from pathlib import Path

import pytest
from fastapi import HTTPException

os.environ.setdefault("DEEPSEEK_API_KEY", "test-deepseek-key")
os.environ.setdefault("SANDBOX_MODE", "local")

from src.api import slides_routes


def run(coro):
    return asyncio.run(coro)


@pytest.fixture(autouse=True)
def local_slide_store(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(slides_routes, "USE_SUPABASE_DB", False)
    monkeypatch.setattr(slides_routes, "LOCAL_STORE", tmp_path / "slides.json")


def presentation_payload(presentation_id: str):
    return slides_routes.PresentationPayload(
        id=presentation_id,
        topic="Private deck",
        slides=[],
    )


def test_local_presentations_are_not_readable_or_deletable_by_other_guests():
    owner = {"sub": "owner-id"}
    other_guest = {"sub": "other-id"}
    presentation_id = "presentation-1"

    run(slides_routes.save_presentation(presentation_payload(presentation_id), owner))

    with pytest.raises(HTTPException) as get_error:
        run(slides_routes.get_presentation(presentation_id, other_guest))
    assert get_error.value.status_code == 404

    with pytest.raises(HTTPException) as delete_error:
        run(slides_routes.delete_presentation(presentation_id, other_guest))
    assert delete_error.value.status_code == 404


def test_local_presentations_cannot_be_overwritten_by_another_guest():
    owner = {"sub": "owner-id"}
    other_guest = {"sub": "other-id"}
    presentation_id = "presentation-1"

    run(slides_routes.save_presentation(presentation_payload(presentation_id), owner))

    with pytest.raises(HTTPException) as error:
        run(slides_routes.save_presentation(presentation_payload(presentation_id), other_guest))
    assert error.value.status_code == 403


def test_slide_generation_uses_text_attachment_content():
    attachment = slides_routes.SlideAttachment(
        name="brief.txt",
        mime_type="text/plain",
        data=base64.b64encode(b"Revenue grew 42 percent year over year.").decode("ascii"),
    )

    context = slides_routes.build_attachment_context([attachment])

    assert "brief.txt" in context
    assert "Revenue grew 42 percent" in context
