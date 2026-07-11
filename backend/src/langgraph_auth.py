from __future__ import annotations

from typing import Any

from fastapi import HTTPException as FastAPIHTTPException
from langgraph_sdk import Auth

from .api.auth import authenticate_authorization_header
from .runtime_context import thread_id_ctx, user_id_ctx


auth = Auth()


def _set_request_context(ctx: Auth.types.AuthContext, value: dict[str, Any]) -> None:
    user_id_ctx.set(ctx.user.identity)
    thread_id = value.get("thread_id")
    if thread_id is not None:
        thread_id_ctx.set(str(thread_id))


@auth.authenticate
async def authenticate(authorization: str | None):
    try:
        payload = authenticate_authorization_header(authorization)
    except FastAPIHTTPException as exc:
        raise Auth.exceptions.HTTPException(
            status_code=exc.status_code,
            detail=str(exc.detail),
        ) from exc
    identity = payload["sub"]
    user_id_ctx.set(identity)
    return {"identity": identity, "permissions": ["guest"]}


@auth.on
async def deny_unhandled(ctx: Auth.types.AuthContext, value: Any):
    return False


@auth.on.threads.create
async def create_thread(ctx: Auth.types.AuthContext, value: dict[str, Any]):
    _set_request_context(ctx, value)
    value.setdefault("metadata", {})["owner"] = ctx.user.identity


@auth.on(resources=["threads"], actions=["read", "search", "update", "delete"])
async def own_threads(ctx: Auth.types.AuthContext, value: dict[str, Any]):
    _set_request_context(ctx, value)
    return {"owner": ctx.user.identity}


@auth.on.threads.create_run
async def create_owned_run(ctx: Auth.types.AuthContext, value: dict[str, Any]):
    _set_request_context(ctx, value)
    value.setdefault("metadata", {})["owner"] = ctx.user.identity
    return {"owner": ctx.user.identity}


@auth.on.store
async def own_store(ctx: Auth.types.AuthContext, value: dict[str, Any]):
    _set_request_context(ctx, value)
    namespace = tuple(value.get("namespace") or ())
    if not namespace or namespace[0] != ctx.user.identity:
        value["namespace"] = (ctx.user.identity, *namespace)


@auth.on(resources=["assistants"], actions=["read", "search"])
async def read_assistants(ctx: Auth.types.AuthContext, value: dict[str, Any]):
    _set_request_context(ctx, value)
    return True


@auth.on(resources=["assistants"], actions=["create", "update", "delete"])
async def deny_assistant_mutation(ctx: Auth.types.AuthContext, value: dict[str, Any]):
    _set_request_context(ctx, value)
    return False
