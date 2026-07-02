"""Model ID helpers shared by API routes and the LangGraph registry."""

PUBLIC_MODEL_IDS = [
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

LEGACY_MODEL_ID_ALIASES = {
    "deepseek-chat": "deepseek",
    "deepseek-reasoner": "deepseek",
    "qwen-plus": "qwen",
    "qwen3-max": "qwen",
    "minimax-m2": "minimax",
    "claude-opus-or": "openrouter",
    "glm-4.7": "zhipu",
    "claude-opus-right": "anthropic",
    "claude-opus-right-thinking": "anthropic",
    "claude-sonnet-right": "anthropic",
    "claude-sonnet-right-thinking": "anthropic",
    "gemini-3-pro": "gemini",
    "gpt-5": "openai",
    "gpt-5-thinking": "openai",
    "llama-4-maverick": "openrouter",
    "llama-3.3-70b": "openrouter",
}


def split_model_variant(model_id: str | None) -> tuple[str | None, str]:
    """Return the base model id plus an optional LangGraph variant suffix."""
    if not model_id:
        return None, ""
    for suffix in ("-web-dev", "-fortune"):
        if model_id.endswith(suffix):
            return model_id[: -len(suffix)], suffix
    return model_id, ""


def public_model_id(model_id: str | None) -> str | None:
    """Map legacy model IDs to the canonical public ID used by the UI."""
    base_id, suffix = split_model_variant(model_id)
    if not base_id:
        return None
    normalized = LEGACY_MODEL_ID_ALIASES.get(base_id, base_id)
    return f"{normalized}{suffix}"
