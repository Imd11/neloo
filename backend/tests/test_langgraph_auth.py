from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from uuid import uuid4

import pytest
from fastapi import HTTPException
from langgraph_sdk import Auth

from src.api.auth import allow_anonymous, get_jwt_secret
from src.langgraph_auth import auth


@dataclass
class _User:
    identity: str
    permissions: tuple[str, ...] = ("guest",)
    is_authenticated: bool = True
    display_name: str = "Guest"


def _context(resource: str, action: str, identity: str = "guest-a"):
    return Auth.types.AuthContext(
        permissions=("guest",),
        user=_User(identity),
        resource=resource,
        action=action,
    )


def _handler(resource: str, action: str):
    return auth._handlers[(resource, action)][-1]


def _guest_token(identity: str, secret: str) -> str:
    payload = json.dumps(
        {"sub": identity, "exp": int(time.time()) + 300},
        separators=(",", ":"),
    ).encode("utf-8")
    encoded = base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")
    signature = hmac.new(secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return f"neloo-anon-v1.{encoded}.{signature}"


@pytest.fixture(autouse=True)
def _anonymous_sessions(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ALLOW_ANONYMOUS", "true")
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_TOKENS", "false")
    monkeypatch.setenv("ANONYMOUS_SESSION_SECRET", "test-anonymous-secret-at-least-32-bytes")
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    allow_anonymous.cache_clear()
    get_jwt_secret.cache_clear()
    yield
    allow_anonymous.cache_clear()
    get_jwt_secret.cache_clear()


@pytest.mark.asyncio
async def test_missing_bearer_token_is_unauthorized():
    with pytest.raises(HTTPException) as exc_info:
        await auth._authenticate_handler(None)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_invalid_bearer_token_is_unauthorized():
    with pytest.raises(HTTPException) as exc_info:
        await auth._authenticate_handler("Bearer invalid")
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_valid_guest_token_returns_identity():
    identity = str(uuid4())
    token = _guest_token(identity, "test-anonymous-secret-at-least-32-bytes")

    user = await auth._authenticate_handler(f"Bearer {token}")

    assert user == {"identity": identity, "permissions": ["guest"]}


@pytest.mark.asyncio
async def test_thread_create_forces_owner_metadata():
    value = {"metadata": {"owner": "attacker", "label": "kept"}}

    await _handler("threads", "create")(_context("threads", "create"), value)

    assert value["metadata"] == {"owner": "guest-a", "label": "kept"}


@pytest.mark.asyncio
@pytest.mark.parametrize("action", ["read", "search", "update", "delete"])
async def test_thread_access_is_filtered_by_owner(action: str):
    result = await _handler("threads", action)(
        _context("threads", action), {"thread_id": uuid4()}
    )

    assert result == {"owner": "guest-a"}


@pytest.mark.asyncio
async def test_store_namespace_is_prefixed_with_identity():
    value = {"namespace": ("projects", "one")}

    await _handler("store", "*")(_context("store", "get"), value)

    assert value["namespace"] == ("guest-a", "projects", "one")


@pytest.mark.asyncio
async def test_unhandled_resource_is_denied_by_default():
    result = await auth._global_handlers[-1](
        _context("runs", "read"), {"run_id": uuid4()}
    )

    assert result is False


@pytest.mark.asyncio
@pytest.mark.parametrize("action", ["create", "update", "delete"])
async def test_guest_cannot_mutate_assistants(action: str):
    result = await _handler("assistants", action)(
        _context("assistants", action), {"assistant_id": uuid4()}
    )

    assert result is False


@pytest.mark.asyncio
async def test_create_run_handler_is_registered_and_scopes_owner():
    assert ("threads", "create_run") in auth._handlers
    assert ("runs", "create") not in auth._handlers
    value = {"thread_id": uuid4(), "metadata": {}}

    result = await _handler("threads", "create_run")(
        _context("threads", "create_run"), value
    )

    assert result == {"owner": "guest-a"}
    assert value["metadata"]["owner"] == "guest-a"
