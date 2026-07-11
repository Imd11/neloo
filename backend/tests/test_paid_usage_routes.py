"""Usage enforcement and overload response tests for paid model routes."""

import os

import pytest
from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import Response

os.environ.setdefault("DEEPSEEK_API_KEY", "test-deepseek-key")

from src.api import resume_ai_routes, slides_routes, translate_routes, webapp

USER_ID = "11111111-1111-4111-8111-111111111111"
USER = {"id": USER_ID, "sub": USER_ID}


def make_request(path: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": path,
            "headers": [],
            "client": ("127.0.0.1", 1234),
            "server": ("testserver", 80),
            "scheme": "http",
            "query_string": b"",
        }
    )


async def deny_usage(*_args, **_kwargs):
    raise HTTPException(status_code=429, detail="Usage limit exceeded")


class RejectConcurrency:
    async def __aenter__(self):
        raise HTTPException(
            status_code=429,
            detail="Too many concurrent requests",
            headers={"Retry-After": "7"},
        )

    async def __aexit__(self, *_args):
        return False


class UnexpectedModel:
    async def ainvoke(self, _messages):
        raise AssertionError("provider must not be called after usage denial")


@pytest.mark.asyncio
async def test_title_generation_denial_prevents_provider_call(monkeypatch):
    monkeypatch.setattr(webapp, "USE_SUPABASE_DB", True)
    monkeypatch.setattr(
        webapp,
        "get_thread_by_langgraph_id",
        lambda _thread_id: _async_value({"user_id": USER_ID, "title": "New Task"}),
    )
    monkeypatch.setattr(webapp, "enforce_usage_limit", deny_usage, raising=False)
    monkeypatch.setattr(webapp, "_generate_title_with_llm", _unexpected_call)

    with pytest.raises(HTTPException) as exc_info:
        await webapp.generate_thread_title_api(
            "thread-1",
            webapp.GenerateTitleRequest(user_message="Create a report"),
            make_request("/api/threads/thread-1/generate-title"),
            USER,
        )

    assert exc_info.value.status_code == 429


@pytest.mark.asyncio
async def test_suggestion_generation_denial_prevents_provider_call(monkeypatch):
    monkeypatch.setattr(webapp, "USE_SUPABASE_DB", True)
    monkeypatch.setattr(
        webapp,
        "get_thread_by_langgraph_id",
        lambda _thread_id: _async_value({"user_id": USER_ID}),
    )
    monkeypatch.setattr(webapp, "enforce_usage_limit", deny_usage, raising=False)
    monkeypatch.setattr(webapp, "_generate_suggested_questions", _unexpected_call)

    with pytest.raises(HTTPException) as exc_info:
        await webapp.generate_suggested_questions_api(
            "thread-1",
            webapp.SuggestedQuestionsRequest(ai_response="Done"),
            make_request("/api/threads/thread-1/generate-suggestions"),
            USER,
        )

    assert exc_info.value.status_code == 429


@pytest.mark.asyncio
@pytest.mark.parametrize("route_name", ["slides", "translate", "resume"])
async def test_concurrency_limit_remains_429(monkeypatch, route_name):
    if route_name == "slides":
        monkeypatch.setattr(slides_routes, "get_model", lambda *_args: UnexpectedModel())
        monkeypatch.setattr(slides_routes, "enforce_usage_limit", _allow_usage)
        monkeypatch.setattr(slides_routes, "usage_concurrency", lambda *_args: RejectConcurrency())
        call = slides_routes.generate_slides_text.__wrapped__(
            request=make_request("/api/slides/generate"),
            response=Response(),
            payload=slides_routes.SlidesLLMRequest(system="system", prompt="prompt"),
            user=USER,
        )
    elif route_name == "translate":
        monkeypatch.setattr(translate_routes, "get_model", lambda *_args: UnexpectedModel())
        monkeypatch.setattr(translate_routes, "enforce_usage_limit", _allow_usage)
        monkeypatch.setattr(
            translate_routes, "usage_concurrency", lambda *_args: RejectConcurrency()
        )
        call = translate_routes.translate.__wrapped__(
            request=make_request("/api/translate"),
            response=Response(),
            payload=translate_routes.TranslateRequest(text="hello"),
            user=USER,
        )
    else:
        monkeypatch.setattr(resume_ai_routes, "get_model", lambda: UnexpectedModel())
        monkeypatch.setattr(resume_ai_routes, "enforce_usage_limit", _allow_usage)
        monkeypatch.setattr(
            resume_ai_routes, "usage_concurrency", lambda *_args: RejectConcurrency()
        )
        call = resume_ai_routes.optimize_resume.__wrapped__(
            request=make_request("/api/resume/optimize"),
            response=Response(),
            payload=resume_ai_routes.OptimizeRequest(
                messages=[resume_ai_routes.ChatMessage(role="user", content="Improve this")]
            ),
            user=USER,
        )

    with pytest.raises(HTTPException) as exc_info:
        await call

    assert exc_info.value.status_code == 429
    assert exc_info.value.headers == {"Retry-After": "7"}


async def _async_value(value):
    return value


async def _allow_usage(*_args, **_kwargs):
    return None


async def _unexpected_call(*_args, **_kwargs):
    raise AssertionError("provider must not be called after usage denial")
