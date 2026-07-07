"""
Test script for the Data Analyst Agent

This script tests the agent's core functionality:
1. Code execution in sandbox
2. Web search
3. Full agent interaction
"""

import os
import sys

import pytest

# Add src to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv


def test_sandbox_execution():
    """Test the sandbox executor"""
    print("\n" + "=" * 60)
    print("[TEST 1] Sandbox Code Execution")
    print("=" * 60)

    sandbox_mode = os.environ.get("SANDBOX_MODE", "e2b").lower()
    if sandbox_mode.startswith("e2b") and not os.environ.get("E2B_API_KEY"):
        pytest.skip("requires E2B_API_KEY")
    if sandbox_mode == "local" and not (
        os.environ.get("ALLOW_LOCAL_SANDBOX") or os.environ.get("ALLOW_ANONYMOUS")
    ):
        pytest.skip("requires ALLOW_LOCAL_SANDBOX")

    from src.sandbox import execute_python

    test_user_id = "test-agent-user"
    test_thread_id = "test-agent-thread"

    # Test 1: Basic computation
    print("\n[1.1] Basic computation...")
    result = execute_python(
        """
import numpy as np
x = np.array([1, 2, 3, 4, 5])
print(f"Mean: {np.mean(x)}")
print(f"Std: {np.std(x):.4f}")
""",
        user_id=test_user_id,
        thread_id=test_thread_id,
    )

    print(f"Success: {result['success']}")
    if result['success']:
        print(f"Output:\n{result['stdout']}")
    else:
        print(f"Error: {result['error']}")

    # Test 2: Pandas operations
    print("\n[1.2] Pandas operations...")
    result = execute_python(
        """
import pandas as pd
import numpy as np

np.random.seed(42)
df = pd.DataFrame({
    'x': np.random.randn(100),
    'y': np.random.randn(100) * 2 + 1
})

print("Data shape:", df.shape)
print("\\nCorrelation matrix:")
print(df.corr())
print("\\nDescriptive statistics:")
print(df.describe())
""",
        user_id=test_user_id,
        thread_id=test_thread_id,
    )

    print(f"Success: {result['success']}")
    if result['success']:
        print(f"Output:\n{result['stdout']}")
    else:
        print(f"Error: {result['error']}")

    # Test 3: Regression with statsmodels
    print("\n[1.3] OLS Regression...")
    result = execute_python(
        """
import statsmodels.api as sm
import numpy as np

np.random.seed(42)
n = 200
X = np.random.randn(n, 2)
y = X @ [2.5, -1.5] + np.random.randn(n) * 0.5

X_const = sm.add_constant(X)
model = sm.OLS(y, X_const).fit()

print(model.summary())
""",
        user_id=test_user_id,
        thread_id=test_thread_id,
    )

    print(f"Success: {result['success']}")
    if result['success']:
        print(f"Output:\n{result['stdout'][:2000]}...")
    else:
        print(f"Error: {result['error']}")

    assert result["success"]


def test_web_search():
    """Test web search functionality"""
    print("\n" + "=" * 60)
    print("[TEST 2] Web Search")
    print("=" * 60)

    from src.tools.search import internet_search

    if not os.environ.get("TAVILY_API_KEY"):
        pytest.skip("requires TAVILY_API_KEY")

    result = internet_search("Python statsmodels OLS regression tutorial", max_results=3)

    if "error" in result and result["error"]:
        print(f"Error: {result['error']}")
        assert not result["error"]

    print(f"Found {len(result.get('results', []))} results:")
    for i, item in enumerate(result.get("results", []), 1):
        print(f"\n{i}. {item.get('title', 'No title')}")
        print(f"   URL: {item.get('url', 'N/A')}")


def test_agent():
    """Test the full agent"""
    print("\n" + "=" * 60)
    print("[TEST 3] Full Agent Interaction")
    print("=" * 60)

    # Check for API keys
    def has_real_api_key(name: str) -> bool:
        value = os.environ.get(name, "").strip()
        return bool(value and not value.startswith("test-"))

    has_api_key = any([
        has_real_api_key("DEEPSEEK_API_KEY"),
        has_real_api_key("ANTHROPIC_API_KEY"),
        has_real_api_key("OPENAI_API_KEY"),
    ])

    if not has_api_key:
        pytest.skip("requires DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY")

    import asyncio

    from langchain_core.messages import HumanMessage
    from src.agent.graph import graph
    from src.runtime_context import thread_id_ctx, user_id_ctx

    query = "Calculate the mean and standard deviation of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] using Python"
    print("\nQuery: Calculate the mean and standard deviation of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]")
    print("-" * 60)

    try:
        user_token = user_id_ctx.set("test-agent-user")
        thread_token = thread_id_ctx.set("test-1")
        try:
            result = asyncio.run(
                graph.ainvoke(
                    {"messages": [HumanMessage(content=query)]},
                    config={"configurable": {"thread_id": "test-1"}},
                )
            )
        finally:
            thread_id_ctx.reset(thread_token)
            user_id_ctx.reset(user_token)

        # Get the last AI message
        for msg in reversed(result["messages"]):
            if hasattr(msg, 'content') and msg.content:
                msg_type = msg.__class__.__name__
                if msg_type == "AIMessage":
                    print(f"\nAI Response:\n{msg.content[:1500]}")
                    break

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        assert False, f"Agent invocation failed: {e}"


def main():
    """Run the agent integration tests through pytest."""
    load_dotenv(override=True)
    return pytest.main([__file__, "-v", "-s"])


if __name__ == "__main__":
    sys.exit(main())
