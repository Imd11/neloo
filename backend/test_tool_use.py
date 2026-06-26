#!/usr/bin/env python3
"""测试代理 API 是否支持 Tool Use"""

import os
import sys

if not os.environ.get("ANTHROPIC_API_KEY"):
    print("Please set ANTHROPIC_API_KEY before running this test.")
    sys.exit(1)

os.environ.setdefault("ANTHROPIC_BASE_URL", "https://api.anthropic.com")

print("=" * 60)
print("测试: 检查代理 API 是否支持 Tool Use")
print("=" * 60)

from langchain_anthropic import ChatAnthropic
from langchain_core.tools import tool

# 直接使用 ChatAnthropic
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
    response = model_with_tools.invoke("请计算 3 + 5")
    content = response.content[:300] if response.content else "No content"
    print(f"\nResponse content: {content}")

    tool_calls = getattr(response, "tool_calls", None)
    print(f"Tool calls: {tool_calls}")

    if tool_calls:
        print("\n✅ 代理 API 支持 Tool Use!")
        for tc in tool_calls:
            print(f"  - Tool: {tc['name']}, Args: {tc['args']}")
    else:
        print("\n❌ 代理 API 不支持 Tool Use 或未正确识别")
        print("   模型直接回复了文本，而不是调用工具")

except Exception as e:
    print(f"❌ 错误: {type(e).__name__}: {e}")
