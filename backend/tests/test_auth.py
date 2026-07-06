"""Tests for auth enforcement and ALLOW_ANONYMOUS gating (Task 1)."""
import os
import sys

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
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    user = run(auth.get_current_user(authorization=None, x_user_id="alice"))
    assert user["sub"] == "alice"


def test_anon_on_secret_set_magic_token_ok(monkeypatch):
    monkeypatch.setenv("ALLOW_ANONYMOUS", "true")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "s3cret")
    assert auth.verify_jwt_token("default")["sub"] == "default"


def test_valid_jwt_decodes_when_secret_set(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "s3cret")
    monkeypatch.delenv("ALLOW_ANONYMOUS", raising=False)
    token = jwt.encode(
        {"sub": "user-123", "aud": "authenticated"}, "s3cret", algorithm="HS256"
    )
    assert auth.verify_jwt_token(token)["sub"] == "user-123"
