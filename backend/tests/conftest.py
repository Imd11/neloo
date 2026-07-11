"""Shared pytest configuration for backend tests.

Puts backend/ on sys.path so tests can `from src...` import, and exposes a
small run_async helper for exercising async callables from sync tests.
"""

import asyncio
import os
import sys

# Ensure backend/ is importable root for `from src.xxx import ...`
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)


def run_async(coro):
    """Run an async coroutine to completion from a synchronous test."""
    return asyncio.run(coro)
