"""Regression coverage for the public model registry defaults."""

import os
from unittest.mock import patch

os.environ.setdefault("DEEPSEEK_API_KEY", "test-deepseek-key")

from src.agent.graph import AVAILABLE_MODELS, MODEL_PROFILES, get_available_models, get_model


def test_canonical_provider_defaults_use_current_model_ids():
    expected_models = {
        "deepseek": "deepseek-v4-pro",
        "qwen": "qwen3.7-max",
        "minimax": "MiniMax-M2.7",
        "anthropic": "claude-opus-4-8",
        "openai": "gpt-5.5",
        "gemini": "gemini-3.1-pro-preview",
        "zhipu": "GLM-5.2",
    }

    for provider_id, model_name in expected_models.items():
        assert AVAILABLE_MODELS[provider_id]["model_name"] == model_name


def test_model_profiles_match_the_current_provider_context_windows():
    assert MODEL_PROFILES["deepseek"]["max_input_tokens"] == 1_000_000
    assert MODEL_PROFILES["anthropic"]["max_input_tokens"] == 1_000_000
    assert MODEL_PROFILES["openai"]["max_input_tokens"] == 1_050_000
    assert MODEL_PROFILES["qwen"]["max_input_tokens"] == 1_000_000
    assert MODEL_PROFILES["minimax"]["max_input_tokens"] == 204_800
    assert MODEL_PROFILES["zhipu"]["max_input_tokens"] == 198_000


def test_public_model_payload_includes_the_resolved_model_name(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-deepseek-key")

    models = get_available_models()
    deepseek = next(model for model in models if model["id"] == "deepseek")

    assert deepseek["available"] is True
    assert deepseek["model_name"] == "deepseek-v4-pro"


def test_legacy_graph_ids_resolve_to_current_canonical_models(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-deepseek-key")
    captured = {}

    class FakeModel:
        profile = None

    def fake_init_chat_model(model_name, **kwargs):
        captured["model_name"] = model_name
        captured["kwargs"] = kwargs
        return FakeModel()

    with patch("langchain.chat_models.init_chat_model", side_effect=fake_init_chat_model):
        get_model("deepseek-chat")

    assert captured["model_name"] == "deepseek-v4-pro"
