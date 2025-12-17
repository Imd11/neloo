"""
Test script for the Data Analyst Agent

This script tests the agent's core functionality:
1. Code execution in sandbox
2. Web search
3. Full agent interaction
"""

import os
import sys

# Add src to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(override=True)


def test_sandbox_execution():
    """Test the sandbox executor"""
    print("\n" + "=" * 60)
    print("[TEST 1] Sandbox Code Execution")
    print("=" * 60)

    from src.sandbox import execute_python

    # Test 1: Basic computation
    print("\n[1.1] Basic computation...")
    result = execute_python("""
import numpy as np
x = np.array([1, 2, 3, 4, 5])
print(f"Mean: {np.mean(x)}")
print(f"Std: {np.std(x):.4f}")
""")

    print(f"Success: {result['success']}")
    if result['success']:
        print(f"Output:\n{result['stdout']}")
    else:
        print(f"Error: {result['error']}")

    # Test 2: Pandas operations
    print("\n[1.2] Pandas operations...")
    result = execute_python("""
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
""")

    print(f"Success: {result['success']}")
    if result['success']:
        print(f"Output:\n{result['stdout']}")
    else:
        print(f"Error: {result['error']}")

    # Test 3: Regression with statsmodels
    print("\n[1.3] OLS Regression...")
    result = execute_python("""
import statsmodels.api as sm
import numpy as np

np.random.seed(42)
n = 200
X = np.random.randn(n, 2)
y = X @ [2.5, -1.5] + np.random.randn(n) * 0.5

X_const = sm.add_constant(X)
model = sm.OLS(y, X_const).fit()

print(model.summary())
""")

    print(f"Success: {result['success']}")
    if result['success']:
        print(f"Output:\n{result['stdout'][:2000]}...")
    else:
        print(f"Error: {result['error']}")

    return result['success']


def test_web_search():
    """Test web search functionality"""
    print("\n" + "=" * 60)
    print("[TEST 2] Web Search")
    print("=" * 60)

    from src.tools.search import internet_search

    if not os.environ.get("TAVILY_API_KEY"):
        print("[SKIP] TAVILY_API_KEY not set")
        return True

    result = internet_search("Python statsmodels OLS regression tutorial", max_results=3)

    if "error" in result and result["error"]:
        print(f"Error: {result['error']}")
        return False

    print(f"Found {len(result.get('results', []))} results:")
    for i, item in enumerate(result.get("results", []), 1):
        print(f"\n{i}. {item.get('title', 'No title')}")
        print(f"   URL: {item.get('url', 'N/A')}")

    return True


def test_agent():
    """Test the full agent"""
    print("\n" + "=" * 60)
    print("[TEST 3] Full Agent Interaction")
    print("=" * 60)

    # Check for API keys
    has_api_key = any([
        os.environ.get("DEEPSEEK_API_KEY"),
        os.environ.get("ANTHROPIC_API_KEY"),
        os.environ.get("OPENAI_API_KEY"),
    ])

    if not has_api_key:
        print("[SKIP] No LLM API key set (DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY)")
        return True

    from src.agent.graph import invoke

    print("\nQuery: Calculate the mean and standard deviation of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]")
    print("-" * 60)

    try:
        result = invoke(
            "Calculate the mean and standard deviation of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] using Python",
            thread_id="test-1"
        )

        # Get the last AI message
        for msg in reversed(result["messages"]):
            if hasattr(msg, 'content') and msg.content:
                msg_type = msg.__class__.__name__
                if msg_type == "AIMessage":
                    print(f"\nAI Response:\n{msg.content[:1500]}")
                    break

        return True

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("Data Analyst Agent - Test Suite")
    print("=" * 60)

    # Show current configuration
    print("\nConfiguration:")
    print(f"  SANDBOX_MODE: {os.environ.get('SANDBOX_MODE', 'e2b (default)')}")
    print(f"  DEEPSEEK_API_KEY: {'Set' if os.environ.get('DEEPSEEK_API_KEY') else 'Not set'}")
    print(f"  ANTHROPIC_API_KEY: {'Set' if os.environ.get('ANTHROPIC_API_KEY') else 'Not set'}")
    print(f"  OPENAI_API_KEY: {'Set' if os.environ.get('OPENAI_API_KEY') else 'Not set'}")
    print(f"  E2B_API_KEY: {'Set' if os.environ.get('E2B_API_KEY') else 'Not set'}")
    print(f"  TAVILY_API_KEY: {'Set' if os.environ.get('TAVILY_API_KEY') else 'Not set'}")

    results = []

    # Test 1: Sandbox
    try:
        results.append(("Sandbox Execution", test_sandbox_execution()))
    except Exception as e:
        print(f"\n[ERROR] Sandbox test failed: {e}")
        results.append(("Sandbox Execution", False))

    # Test 2: Web Search
    try:
        results.append(("Web Search", test_web_search()))
    except Exception as e:
        print(f"\n[ERROR] Web search test failed: {e}")
        results.append(("Web Search", False))

    # Test 3: Full Agent
    try:
        results.append(("Full Agent", test_agent()))
    except Exception as e:
        print(f"\n[ERROR] Agent test failed: {e}")
        results.append(("Full Agent", False))

    # Summary
    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)
    for name, passed in results:
        status = "PASS" if passed else "FAIL"
        print(f"  {name}: [{status}]")

    all_passed = all(r[1] for r in results)
    print("\n" + ("All tests passed!" if all_passed else "Some tests failed."))

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
