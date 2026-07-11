"""Helpers for keeping model-only hidden prompts out of visible chat history."""

HIDDEN_PROMPT_KEY = "neloo_hidden_prompt"

LEGACY_HIDDEN_PREFIX_MARKERS = (
    "You are a senior prompt engineer.",
    "Act like a professional content writer",
    "Analysis direction:",
    "[System: You are now acting as the agent",
)


def strip_legacy_hidden_prompt_prefix(content: str) -> str:
    """
    Best-effort cleanup for messages saved before the hidden prompt envelope
    existed. This handles known Neloo-generated prefixes only.
    """
    if not isinstance(content, str):
        return content

    stripped = content.lstrip()
    if not stripped.startswith(LEGACY_HIDDEN_PREFIX_MARKERS):
        return content

    markers = (
        "\nUser information:\n",
        "\nRewrite the user's text. Return only the rewritten text.",
        "\n- Do not answer the user's task. Only return the improved prompt.",
        "\n---\nUser message:]\n",
    )

    for marker in markers:
        marker_index = stripped.find(marker)
        if marker_index >= 0:
            return stripped[marker_index + len(marker) :].lstrip()

    return content


def sanitize_hidden_prompt_message_data(message_data: dict) -> dict:
    """
    Persist only user-visible content for human messages that carry a Neloo
    hidden prompt envelope. Also clean legacy messages that were saved before
    the envelope existed. Keep non-secret context metadata for diagnostics.
    """
    if not isinstance(message_data, dict):
        return message_data

    if message_data.get("type") not in {"human", "user"}:
        return message_data

    content = message_data.get("content")
    additional_kwargs = message_data.get("additional_kwargs")
    if not isinstance(additional_kwargs, dict):
        if isinstance(content, str):
            sanitized_content = strip_legacy_hidden_prompt_prefix(content)
            if sanitized_content != content:
                sanitized = dict(message_data)
                sanitized["content"] = sanitized_content
                return sanitized
        return message_data

    envelope = additional_kwargs.get(HIDDEN_PROMPT_KEY)
    if not isinstance(envelope, dict):
        if isinstance(content, str):
            sanitized_content = strip_legacy_hidden_prompt_prefix(content)
            if sanitized_content != content:
                sanitized = dict(message_data)
                sanitized["content"] = sanitized_content
                return sanitized
        return message_data

    visible_content = envelope.get("visibleContent")
    if not isinstance(visible_content, str):
        return message_data

    sanitized = dict(message_data)
    sanitized["content"] = visible_content

    sanitized_additional = dict(additional_kwargs)
    sanitized_envelope = dict(envelope)
    sanitized_envelope.pop("hiddenPrefix", None)
    sanitized_additional[HIDDEN_PROMPT_KEY] = sanitized_envelope
    sanitized["additional_kwargs"] = sanitized_additional
    return sanitized
