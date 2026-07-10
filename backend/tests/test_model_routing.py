"""Regression coverage for routes that must use the configured model registry."""

import os
from importlib import import_module
from types import SimpleNamespace

import pytest

os.environ.setdefault("DEEPSEEK_API_KEY", "test-deepseek-key")

from src.api import agent_routes
from src.api import resume_ai_routes
from src.api import webapp

graph_module = import_module("src.agent.graph")


@pytest.mark.asyncio
async def test_prompt_generation_uses_the_default_configured_model(monkeypatch):
    class FakeModel:
        async def ainvoke(self, _messages):
            return SimpleNamespace(content="Generated prompt")

    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.setattr(agent_routes, "get_model", lambda: FakeModel(), raising=False)

    result = await agent_routes.generate_prompt(
        agent_routes.GeneratePromptRequest(
            name="Research assistant",
            description="Summarizes research",
            tools=["search_web"],
        ),
        user={"id": "test-user"},
    )

    assert result.system_prompt == "Generated prompt"


@pytest.mark.asyncio
async def test_thread_titles_use_the_default_configured_model(monkeypatch):
    class FakeModel:
        async def ainvoke(self, _messages):
            return SimpleNamespace(content="Registry-generated title")

    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setattr(graph_module, "get_model", lambda: FakeModel())

    title = await webapp._generate_title_with_llm("Summarize this long research report")

    assert title == "Registry-generated title"


@pytest.mark.asyncio
async def test_resume_optimization_uses_the_default_configured_model(monkeypatch):
    class FakeModel:
        def __init__(self):
            self.messages = []

        async def ainvoke(self, messages):
            self.messages = messages
            return SimpleNamespace(content="Improved resume content")

    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    model = FakeModel()
    monkeypatch.setattr(resume_ai_routes, "get_model", lambda: model, raising=False)

    result = await resume_ai_routes.optimize_resume.__wrapped__(
        request=None,
        response=None,
        payload=resume_ai_routes.OptimizeRequest(
            messages=[
                resume_ai_routes.ChatMessage(role="user", content="Improve this resume"),
                resume_ai_routes.ChatMessage(role="assistant", content="Previous suggestion"),
            ]
        ),
        user={"id": "test-user"},
    )

    assert result.content == "Improved resume content"
    assert [message.type for message in model.messages] == ["system", "human", "ai"]


def test_agent_icon_provider_prefers_current_gemini_image_configuration(monkeypatch):
    monkeypatch.setenv("GEMINI_IMAGE_API_KEY", "test-gemini-image-key")
    monkeypatch.setenv("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    provider_selector = getattr(agent_routes, "get_agent_icon_provider", None)

    assert provider_selector is not None
    assert provider_selector()["provider"] == "gemini"
    assert provider_selector()["model"] == "gemini-3.1-flash-image"


def test_agent_icon_provider_reuses_the_configured_gemini_chat_key(monkeypatch):
    monkeypatch.delenv("GEMINI_IMAGE_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "test-gemini-chat-key")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    provider = agent_routes.get_agent_icon_provider()

    assert provider is not None
    assert provider["provider"] == "gemini"


def test_agent_icon_provider_uses_openai_defaults_for_blank_optional_values(monkeypatch):
    monkeypatch.delenv("GEMINI_IMAGE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")
    monkeypatch.setenv("OPENAI_BASE_URL", "")
    monkeypatch.setenv("OPENAI_IMAGE_MODEL", "")

    provider = agent_routes.get_agent_icon_provider()

    assert provider == {
        "provider": "openai",
        "api_key": "test-openai-key",
        "base_url": "https://api.openai.com",
        "model": "gpt-image-2",
    }
