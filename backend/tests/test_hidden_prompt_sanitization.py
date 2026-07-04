import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.hidden_prompt_sanitization import sanitize_hidden_prompt_message_data


def test_sanitize_hidden_prompt_envelope_uses_visible_content():
    message = {
        "id": "msg-1",
        "type": "human",
        "content": "You are a senior prompt engineer.\n\nsecret\n\nhello",
        "additional_kwargs": {
            "neloo_hidden_prompt": {
                "visibleContent": "hello",
                "context": {"feature": "prompt-optimize", "templateId": 1},
            }
        },
    }

    sanitized = sanitize_hidden_prompt_message_data(message)

    assert sanitized["content"] == "hello"
    assert sanitized["additional_kwargs"]["neloo_hidden_prompt"]["context"] == {
        "feature": "prompt-optimize",
        "templateId": 1,
    }


def test_sanitize_legacy_prompt_optimize_prefix_best_effort():
    message = {
        "id": "msg-2",
        "type": "human",
        "content": (
            "You are a senior prompt engineer.\n\n"
            "- Do not answer the user's task. Only return the improved prompt."
            "hello"
        ),
    }

    sanitized = sanitize_hidden_prompt_message_data(message)

    assert sanitized["content"] == "hello"


def test_sanitize_legacy_fortune_prefix_best_effort():
    message = {
        "id": "msg-3",
        "type": "human",
        "content": "Analysis direction: Career.\n\nUser information:\n1990-01-01",
    }

    sanitized = sanitize_hidden_prompt_message_data(message)

    assert sanitized["content"] == "1990-01-01"
