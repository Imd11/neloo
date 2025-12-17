#!/usr/bin/env python3
"""
Quick test script for local development

Usage:
    # Set sandbox mode to local for testing without E2B
    export SANDBOX_MODE=local

    # Run the test
    python run_test.py
"""

import os
import sys

# Set default to local for quick testing
if "SANDBOX_MODE" not in os.environ:
    os.environ["SANDBOX_MODE"] = "local"
    print("[INFO] Using SANDBOX_MODE=local (set E2B_API_KEY and SANDBOX_MODE=e2b for cloud sandbox)")

# Disable LangSmith tracing for local testing
os.environ["LANGCHAIN_TRACING_V2"] = "false"

# Add src to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(override=True)


def main():
    print("\n" + "=" * 60)
    print("Data Analyst Agent - Quick Test")
    print("=" * 60)

    # Test 1: Sandbox execution
    print("\n[1] Testing code execution...")
    from src.sandbox import execute_python

    result = execute_python("""
import numpy as np
data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
print(f"Data: {data}")
print(f"Mean: {np.mean(data)}")
print(f"Std: {np.std(data):.4f}")
print(f"Sum: {np.sum(data)}")
""")

    if result["success"]:
        print("[OK] Code execution works!")
        print(result["stdout"])
    else:
        print(f"[FAIL] {result['error']}")
        return 1

    # Test 2: Check if LLM API is available
    print("\n[2] Checking LLM API...")
    has_llm = any([
        os.environ.get("DEEPSEEK_API_KEY"),
        os.environ.get("ANTHROPIC_API_KEY"),
        os.environ.get("OPENAI_API_KEY"),
    ])

    if not has_llm:
        print("[WARN] No LLM API key found. Set one of:")
        print("  - DEEPSEEK_API_KEY")
        print("  - ANTHROPIC_API_KEY")
        print("  - OPENAI_API_KEY")
        print("\nSkipping agent test...")
        return 0

    # Test 3: Full agent
    print("\n[3] Testing full agent...")
    from src.agent.graph import invoke

    try:
        result = invoke(
            "Please use Python to calculate: 2 + 2 * 3",
            thread_id="quick-test"
        )

        # Get final response
        for msg in reversed(result["messages"]):
            if msg.__class__.__name__ == "AIMessage" and msg.content:
                print(f"\n[AI Response]\n{msg.content}")
                break

        print("\n[OK] Agent works!")
        return 0

    except Exception as e:
        print(f"[FAIL] {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
