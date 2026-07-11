"""
Runtime request context for the agent/tooling layer.

LangGraph tool calls (e.g. execute_python) need access to the authenticated user_id
and current thread_id so we can:
- sync the correct user's files into the sandbox
- associate generated artifacts with the right thread

We use ContextVar so values can be set per-request in FastAPI middleware.
"""

from __future__ import annotations

from contextvars import ContextVar
from typing import Any

from langchain_core.runnables import RunnableConfig

user_id_ctx: ContextVar[str | None] = ContextVar("user_id", default=None)
thread_id_ctx: ContextVar[str | None] = ContextVar("thread_id", default=None)


def user_id_from_config(config: RunnableConfig | None) -> str | None:
    """Return only a usable identity from a LangGraph runtime config."""
    configurable: Any = (config or {}).get("configurable") or {}
    if not isinstance(configurable, dict):
        return None
    value = configurable.get("langgraph_auth_user_id") or configurable.get("user_id")
    if not isinstance(value, str) or value in {"", "default", "anonymous"}:
        return None
    return value
