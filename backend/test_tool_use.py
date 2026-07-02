#!/usr/bin/env python3
"""Test whether the proxy API supports tool use."""

import os
import sys

if not os.environ.get("ANTHROPIC_API_KEY"):
    print("Please set ANTHROPIC_API_KEY before running this test.")
    sys.exit(1)

os.environ.setdefault("ANTHROPIC_BASE_URL", "https://api.anthropic.com")

print("=" * 60)
print("Test: check whether the proxy API supports tool use")
print("=" * 60)

from langchain_anthropic import ChatAnthropic
from langchain_core.tools import tool

# Use ChatAnthropic directly.
model = ChatAnthropic(
    model="claude-3-5-sonnet-20241022",
    api_key=os.environ.get("ANTHROPIC_API_KEY"),
    base_url=os.environ.get("ANTHROPIC_BASE_URL"),
)

print(f"Model: {model.model}")

@tool
def add_numbers(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b

model_with_tools = model.bind_tools([add_numbers])

try:
    response = model_with_tools.invoke("Please calculate 3 + 5.")
    content = response.content[:300] if response.content else "No content"
    print(f"\nResponse content: {content}")

    tool_calls = getattr(response, "tool_calls", None)
    print(f"Tool calls: {tool_calls}")

    if tool_calls:
        print("\nProxy API supports tool use.")
        for tc in tool_calls:
            print(f"  - Tool: {tc['name']}, Args: {tc['args']}")
    else:
        print("\nProxy API does not support tool use or did not detect the tool correctly.")
        print("   The model returned text directly instead of calling the tool.")

except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
