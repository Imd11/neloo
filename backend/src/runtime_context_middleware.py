"""
ASGI middleware to inject authenticated runtime context into ContextVars.

Why this exists:
- LangGraph's `/threads/{thread_id}/runs/*` endpoints are served by the LangGraph
  root ASGI app, not necessarily by the mounted FastAPI `webapp` instance.
- Tooling (file sync, sandbox execution, DB associations) relies on ContextVars
  to know the current `user_id` and `thread_id`.

If we only set ContextVars in FastAPI middleware, LangGraph streaming requests
can still run with default context (e.g. `user_id=default`), which breaks file
syncing and thread/file association.
"""

from __future__ import annotations

from typing import Callable, Awaitable

from .runtime_context import user_id_ctx, thread_id_ctx
from .api.auth import (
    allow_anonymous,
    allow_insecure_local_tokens,
    extract_token_from_header,
    verify_jwt_token,
)


def _extract_thread_id_from_path(path: str) -> str | None:
    parts = [p for p in path.split("/") if p]
    for i, part in enumerate(parts):
        if part == "threads" and i + 1 < len(parts):
            return parts[i + 1]
    return None


class RuntimeContextASGIMiddleware:
    def __init__(self, app: Callable[..., Awaitable[None]]):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            return await self.app(scope, receive, send)

        headers = {}
        for k, v in scope.get("headers") or []:
            try:
                headers[k.decode("latin-1").lower()] = v.decode("latin-1")
            except Exception:
                continue

        path = scope.get("path") or ""
        thread_id = _extract_thread_id_from_path(path) or "default"

        user_id = "default"
        token = extract_token_from_header(headers.get("authorization"))
        if token:
            try:
                payload = verify_jwt_token(token)
                user_id = payload.get("sub", "default")
            except Exception:
                user_id = "default"
        elif allow_anonymous() and allow_insecure_local_tokens():
            user_id = headers.get("x-user-id") or "default"

        user_token = user_id_ctx.set(user_id)
        thread_token = thread_id_ctx.set(thread_id)
        try:
            return await self.app(scope, receive, send)
        finally:
            user_id_ctx.reset(user_token)
            thread_id_ctx.reset(thread_token)
