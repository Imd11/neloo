import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.model_ids import PUBLIC_MODEL_IDS, public_model_id, split_model_variant


def test_public_model_ids_are_canonical_selector_entries():
    assert PUBLIC_MODEL_IDS == [
        "deepseek",
        "qwen",
        "minimax",
        "anthropic",
        "openai",
        "gemini",
        "zhipu",
        "openrouter",
        "custom-openai",
        "custom-anthropic",
    ]


def test_legacy_model_ids_map_to_public_ids():
    assert public_model_id("deepseek-chat") == "deepseek"
    assert public_model_id("deepseek-reasoner") == "deepseek"
    assert public_model_id("qwen3-max") == "qwen"
    assert public_model_id("gpt-5-thinking") == "openai"
    assert public_model_id("claude-opus-right-thinking") == "anthropic"
    assert public_model_id("llama-3.3-70b") == "openrouter"


def test_variant_suffixes_are_preserved():
    assert split_model_variant("qwen3-max-web-dev") == ("qwen3-max", "-web-dev")
    assert split_model_variant("claude-opus-right-fortune") == (
        "claude-opus-right",
        "-fortune",
    )
    assert public_model_id("qwen3-max-web-dev") == "qwen-web-dev"
    assert public_model_id("claude-opus-right-fortune") == "anthropic-fortune"


def test_unknown_and_empty_model_ids_are_left_safe():
    assert public_model_id("custom-openai") == "custom-openai"
    assert public_model_id("future-model") == "future-model"
    assert public_model_id(None) is None
