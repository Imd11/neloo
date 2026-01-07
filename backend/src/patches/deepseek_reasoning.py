"""
Patch for langchain_deepseek to preserve reasoning_content in tool call flows.

DeepSeek API requires reasoning_content to be passed back in multi-turn
conversations when tool calls are involved. The original langchain_deepseek
library doesn't preserve this field, causing 400 errors.

This patch fixes: "Missing `reasoning_content` field in the assistant message"

Reference: https://api-docs.deepseek.com/guides/thinking_mode#tool-calls
"""

import json
from typing import Any


def apply_patch():
    """Apply the reasoning_content preservation patch to langchain_deepseek."""
    try:
        from langchain_deepseek.chat_models import ChatDeepSeek
        from langchain_core.messages import BaseMessage
    except ImportError:
        # langchain_deepseek not installed, skip patch
        return

    # Store original method
    _original_get_request_payload = ChatDeepSeek._get_request_payload

    def _patched_get_request_payload(
        self,
        input_: Any,
        *,
        stop: list[str] | None = None,
        **kwargs: Any,
    ) -> dict:
        """Patched version that preserves reasoning_content for tool calls."""
        # Get input messages before they're converted to dict
        if isinstance(input_, list):
            input_messages = input_
        elif hasattr(input_, 'messages'):
            input_messages = input_.messages
        else:
            input_messages = []

        # Build a list of reasoning_content from AIMessages (in order)
        reasoning_contents = []
        for msg in input_messages:
            if isinstance(msg, BaseMessage) and msg.type == "ai":
                rc = msg.additional_kwargs.get("reasoning_content")
                reasoning_contents.append(rc)  # May be None

        # Call original method
        payload = _original_get_request_payload(self, input_, stop=stop, **kwargs)

        # Add reasoning_content to assistant messages that have tool_calls
        assistant_idx = 0
        for message in payload["messages"]:
            if message["role"] == "tool" and isinstance(message["content"], list):
                message["content"] = json.dumps(message["content"])
            elif message["role"] == "assistant":
                # Add reasoning_content if available and message has tool_calls
                if (assistant_idx < len(reasoning_contents)
                    and reasoning_contents[assistant_idx]
                    and message.get("tool_calls")):
                    message["reasoning_content"] = reasoning_contents[assistant_idx]

                if isinstance(message["content"], list):
                    text_parts = [
                        block.get("text", "")
                        for block in message["content"]
                        if isinstance(block, dict) and block.get("type") == "text"
                    ]
                    message["content"] = "".join(text_parts) if text_parts else ""

                assistant_idx += 1

        return payload

    # Apply patch
    ChatDeepSeek._get_request_payload = _patched_get_request_payload
    print("[Patch] Applied deepseek_reasoning patch for reasoning_content preservation")
