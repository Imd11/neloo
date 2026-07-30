"""Runtime middleware must gate LangGraph native endpoints without a verified identity.

LangGraph's platform endpoints (/threads, /runs, /assistants, /store, /history)
are served on the same `app` (see langgraph.json http.app) and are not covered
by FastAPI Depends(get_current_user). The _set_runtime_context middleware is
the only gate, so a call that resolves to user_id=None must not fall through
to execute a run / stream / read thread state — it must be rejected with 401.
"""
import os
import sys

# webapp transitively builds a chat model at import; a dummy key lets us import
# it to reach the middleware. Removed once models are lazy at import.
os.environ.setdefault("DEEPSEEK_API_KEY", "test-dummy-key-for-import")

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.api import auth, webapp


@pytest.fixture(autouse=True)
def _clear_caches():
    auth.get_jwt_secret.cache_clear()
    auth.allow_anonymous.cache_clear()
    yield
    auth.get_jwt_secret.cache_clear()
    auth.allow_anonymous.cache_clear()


def _anon_off(monkeypatch):
    monkeypatch.delenv("ALLOW_ANONYMOUS", raising=False)
    monkeypatch.delenv("ALLOW_INSECURE_LOCAL_TOKENS", raising=False)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    auth.get_jwt_secret.cache_clear()
    auth.allow_anonymous.cache_clear()


def test_langgraph_native_endpoint_unauthenticated_returns_401(monkeypatch):
    _anon_off(monkeypatch)
    client = TestClient(webapp.app)
    r = client.get("/threads/t1/runs/stream")
    assert r.status_code == 401


def test_langgraph_native_endpoint_rejects_invalid_token(monkeypatch):
    _anon_off(monkeypatch)
    client = TestClient(webapp.app)
    r = client.get("/threads/t1/runs/stream", headers={"Authorization": "Bearer bogus"})
    assert r.status_code == 401


def test_assistants_endpoint_unauthenticated_returns_401(monkeypatch):
    _anon_off(monkeypatch)
    client = TestClient(webapp.app)
    assert client.get("/assistants").status_code == 401


def test_public_docs_not_gated(monkeypatch):
    """Public endpoints (/docs, /openapi.json) must not be caught by the gate."""
    _anon_off(monkeypatch)
    client = TestClient(webapp.app)
    assert client.get("/docs").status_code != 401
    assert client.get("/openapi.json").status_code != 401


def test_native_endpoint_classifier():
    """Match LangGraph native endpoints; spare our /api/... routes + public docs."""
    assert webapp._is_langgraph_native_endpoint("/threads/t1/runs/stream")
    assert webapp._is_langgraph_native_endpoint("/threads")
    assert webapp._is_langgraph_native_endpoint("/runs/r1")
    assert webapp._is_langgraph_native_endpoint("/assistants")
    assert webapp._is_langgraph_native_endpoint("/store/items")
    assert webapp._is_langgraph_native_endpoint("/history/x")
    assert not webapp._is_langgraph_native_endpoint("/api/threads/t1")
    assert not webapp._is_langgraph_native_endpoint("/api/threads/t1/generate-title")
    assert not webapp._is_langgraph_native_endpoint("/docs")
    assert not webapp._is_langgraph_native_endpoint("/openapi.json")
    assert not webapp._is_langgraph_native_endpoint("/")


def test_anon_local_mode_passes_gate(monkeypatch):
    """In explicit local-dev anonymous mode, a request carrying an x-user-id
    still passes the gate so `langgraph dev` works without a Bearer token."""
    monkeypatch.setenv("ALLOW_ANONYMOUS", "true")
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_TOKENS", "true")
    auth.allow_anonymous.cache_clear()
    client = TestClient(webapp.app)
    # Route doesn't exist on bare webapp TestClient → 404, but NOT a gate 401.
    r = client.get("/threads/t1/runs/stream", headers={"x-user-id": "local-user"})
    assert r.status_code != 401


def test_signed_guest_session_passes_gate(monkeypatch):
    """A valid neloo-anon-v1 guest session must pass the native-endpoint gate."""
    import base64
    import hashlib
    import hmac
    import json
    import time

    secret = "guest-session-secret"
    user_id = "2f582f98-dbf6-4d9d-a05e-89f99d6415f8"
    monkeypatch.setenv("ALLOW_ANONYMOUS", "true")
    monkeypatch.setenv("ANONYMOUS_SESSION_SECRET", secret)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    auth.allow_anonymous.cache_clear()

    payload = base64.urlsafe_b64encode(
        json.dumps({"sub": user_id, "exp": int(time.time()) + 60}).encode("utf-8")
    ).decode("ascii").rstrip("=")
    sig = hmac.new(secret.encode(), payload.encode("ascii"), hashlib.sha256).hexdigest()
    token = f"neloo-anon-v1.{payload}.{sig}"

    client = TestClient(webapp.app)
    r = client.get(
        "/threads/t1/runs/stream", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code != 401
