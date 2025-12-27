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

user_id_ctx: ContextVar[str] = ContextVar("user_id", default="default")
thread_id_ctx: ContextVar[str] = ContextVar("thread_id", default="default")

