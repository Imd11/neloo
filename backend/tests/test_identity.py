"""Tests for app identity persistence boundaries."""

import asyncio

import pytest
from fastapi import HTTPException

from src import identity
from src.api import auth
from src.storage import supabase_db


def run(coro):
    return asyncio.run(coro)


class _Result:
    data = [{"id": "11111111-1111-4111-8111-111111111111"}]


class _Query:
    def __init__(self, calls):
        self.calls = calls

    def upsert(self, payload, on_conflict):
        self.calls.append((payload, on_conflict))
        return self

    async def execute(self):
        return _Result()


class _Client:
    def __init__(self, calls):
        self.calls = calls

    def table(self, name):
        assert name == "app_identities"
        return _Query(self.calls)


def test_ensure_identity_upserts_guest_once(monkeypatch):
    calls = []
    monkeypatch.setattr(identity, "database_is_configured", lambda: True)

    async def client():
        return _Client(calls)

    monkeypatch.setattr(identity, "get_supabase_client", client)
    run(identity.ensure_app_identity("11111111-1111-4111-8111-111111111111", "guest"))

    assert len(calls) == 1
    payload, conflict = calls[0]
    assert payload["id"] == "11111111-1111-4111-8111-111111111111"
    assert payload["identity_type"] == "guest"
    assert conflict == "id"


def test_ensure_identity_is_noop_without_supabase(monkeypatch):
    monkeypatch.setattr(identity, "database_is_configured", lambda: False)

    async def unexpected_client():
        raise AssertionError("database client should not be created")

    monkeypatch.setattr(identity, "get_supabase_client", unexpected_client)
    assert run(identity.ensure_app_identity("11111111-1111-4111-8111-111111111111", "guest")) is None


def test_authenticated_request_ensures_identity_before_route(monkeypatch):
    calls = []

    async def ensure(user_id, identity_type):
        calls.append((user_id, identity_type))

    monkeypatch.setattr(identity, "ensure_app_identity", ensure)
    user = {"sub": "11111111-1111-4111-8111-111111111111", "identity_type": "guest"}

    result = run(identity.get_persistent_user(user))

    assert result is user
    assert calls == [(user["sub"], "guest")]


def test_database_failure_does_not_forge_default_identity(monkeypatch):
    monkeypatch.setattr(identity, "database_is_configured", lambda: True)

    async def broken_client():
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(identity, "get_supabase_client", broken_client)

    with pytest.raises(HTTPException) as exc:
        run(identity.ensure_app_identity("11111111-1111-4111-8111-111111111111", "guest"))
    assert exc.value.status_code == 503
    assert "default" not in str(exc.value.detail).lower()


def test_database_outage_does_not_block_runtime_auth(monkeypatch):
    monkeypatch.setenv("ALLOW_ANONYMOUS", "true")
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_TOKENS", "true")
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    auth.allow_anonymous.cache_clear()

    user = auth.verify_jwt_token("local-dev:11111111-1111-4111-8111-111111111111")

    assert user["sub"] == "11111111-1111-4111-8111-111111111111"
    assert user["identity_type"] == "guest"


def test_persistence_write_fails_before_business_insert_when_identity_upsert_fails(monkeypatch):
    async def fail_identity(*_args):
        raise HTTPException(status_code=503, detail="Identity persistence unavailable")

    async def unexpected_client():
        raise AssertionError("business persistence must not start")

    monkeypatch.setattr(supabase_db, "USE_SUPABASE_DB", True)
    monkeypatch.setattr(supabase_db, "_ensure_guest_identity", fail_identity)
    monkeypatch.setattr(supabase_db, "get_supabase_client", unexpected_client)

    with pytest.raises(HTTPException) as exc:
        run(
            supabase_db.save_file_record(
                user_id="11111111-1111-4111-8111-111111111111",
                filename="report.txt",
                storage_path="guest/report.txt",
                file_size=10,
                content_type="text/plain",
                file_type="uploaded",
            )
        )
    assert exc.value.status_code == 503
