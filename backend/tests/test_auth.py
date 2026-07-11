"""Tests for auth enforcement and ALLOW_ANONYMOUS gating (Task 1)."""
import os
import sys
import base64
import hashlib
import hmac
import json
import time

import jwt
import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.api import auth


def run(coro):
    import asyncio
    return asyncio.run(coro)


@pytest.fixture(autouse=True)
def _clear_env_caches():
    """Reset lru_cache on env-reading helpers between tests."""
    auth.get_jwt_secret.cache_clear()
    auth.allow_anonymous.cache_clear()
    yield
    auth.get_jwt_secret.cache_clear()
    auth.allow_anonymous.cache_clear()


def test_anon_off_no_secret_no_token_returns_401(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("ALLOW_ANONYMOUS", raising=False)
    with pytest.raises(HTTPException) as exc:
        run(auth.get_current_user(authorization=None, x_user_id=None))
    assert exc.value.status_code == 401


def test_anon_off_secret_set_rejects_magic_token(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "s3cret")
    monkeypatch.delenv("ALLOW_ANONYMOUS", raising=False)
    with pytest.raises(HTTPException):
        auth.verify_jwt_token("anonymous")


def test_anon_off_secret_set_rejects_missing_token(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "s3cret")
    monkeypatch.delenv("ALLOW_ANONYMOUS", raising=False)
    with pytest.raises(HTTPException) as exc:
        run(auth.get_current_user(authorization=None, x_user_id=None))
    assert exc.value.status_code == 401


def test_anon_on_no_token_allows_default_user(monkeypatch):
    monkeypatch.setenv("ALLOW_ANONYMOUS", "true")
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_TOKENS", "true")
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    user = run(auth.get_current_user(authorization=None, x_user_id="alice"))
    assert user["sub"] == "alice"


def test_anon_on_secret_set_magic_token_ok(monkeypatch):
    monkeypatch.setenv("ALLOW_ANONYMOUS", "true")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "s3cret")
    with pytest.raises(HTTPException) as exc:
        auth.verify_jwt_token("default")
    assert exc.value.status_code == 401


def test_anon_on_local_browser_token_keeps_a_distinct_user_id(monkeypatch):
    monkeypatch.setenv("ALLOW_ANONYMOUS", "true")
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_TOKENS", "true")
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)

    user = auth.verify_jwt_token("local-dev:2f582f98-dbf6-4d9d-a05e-89f99d6415f8")

    assert user["sub"] == "2f582f98-dbf6-4d9d-a05e-89f99d6415f8"


def test_anon_on_rejects_malformed_local_browser_token(monkeypatch):
    monkeypatch.setenv("ALLOW_ANONYMOUS", "true")
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_TOKENS", "true")
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)

    with pytest.raises(HTTPException) as exc:
        auth.verify_jwt_token("local-dev:not-a-uuid")
    assert exc.value.status_code == 401


def test_signed_guest_session_authenticates_without_insecure_local_tokens(monkeypatch):
    secret = "guest-session-secret"
    user_id = "2f582f98-dbf6-4d9d-a05e-89f99d6415f8"
    monkeypatch.setenv("ALLOW_ANONYMOUS", "true")
    monkeypatch.setenv("ANONYMOUS_SESSION_SECRET", secret)
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_TOKENS", "false")
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)

    payload = base64.urlsafe_b64encode(
        json.dumps({"sub": user_id, "exp": int(time.time()) + 60}).encode("utf-8")
    ).decode("ascii").rstrip("=")
    signature = hmac.new(secret.encode("utf-8"), payload.encode("ascii"), hashlib.sha256).hexdigest()

    assert auth.verify_jwt_token(f"neloo-anon-v1.{payload}.{signature}")["sub"] == user_id


def test_valid_jwt_decodes_when_secret_set(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "s3cret")
    monkeypatch.delenv("ALLOW_ANONYMOUS", raising=False)
    token = jwt.encode(
        {"sub": "user-123", "aud": "authenticated"}, "s3cret", algorithm="HS256"
    )
    assert auth.verify_jwt_token(token)["sub"] == "user-123"
