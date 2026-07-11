"""Atomic, fail-closed integration action idempotency tests."""

import os

import pytest

os.environ.setdefault("DEEPSEEK_API_KEY", "test-deepseek-key")

from src.agent import integration_tools

CONFIG = {
    "run_id": "run-1",
    "configurable": {
        "langgraph_auth_user_id": "11111111-1111-4111-8111-111111111111",
        "thread_id": "thread-1",
    },
}


class ProviderTool:
    def __init__(self, result=None, error=None):
        self.calls = 0
        self.result = result or {"id": "result-1"}
        self.error = error

    async def ainvoke(self, _params):
        self.calls += 1
        if self.error:
            raise self.error
        return self.result


async def invoke(monkeypatch, reservation, provider=None):
    provider = provider or ProviderTool()
    updates = []

    async def identity(*_args):
        return None

    async def client():
        return object()

    async def connected(*_args):
        return True

    async def reserve(*_args, **_kwargs):
        if isinstance(reservation, Exception):
            raise reservation
        return reservation

    async def update(*_args, **kwargs):
        updates.append(kwargs)

    monkeypatch.setattr(integration_tools, "ensure_app_identity", identity)
    monkeypatch.setattr(integration_tools, "get_supabase_client", client)
    monkeypatch.setattr(integration_tools, "_verify_connected_app", connected)
    monkeypatch.setattr(integration_tools, "_reserve_integration_action", reserve)
    monkeypatch.setattr(integration_tools, "_get_composio_tool", lambda *_args: provider)
    monkeypatch.setattr(integration_tools, "_update_integration_action", update)

    result = await integration_tools._invoke_allowed_action(
        "gmail", "GMAIL_SEND_EMAIL", {"to": "person@example.test"}, "write", CONFIG
    )
    return result, provider, updates


@pytest.mark.asyncio
async def test_reservation_failure_prevents_provider_call(monkeypatch):
    result, provider, _ = await invoke(monkeypatch, RuntimeError("database unavailable"))
    assert result["status"] == "error"
    assert provider.calls == 0


@pytest.mark.asyncio
async def test_duplicate_pending_action_is_not_executed(monkeypatch):
    result, provider, _ = await invoke(monkeypatch, {"created": False, "status": "pending"})
    assert result["status"] == "in_progress"
    assert provider.calls == 0


@pytest.mark.asyncio
async def test_duplicate_success_returns_cached_result(monkeypatch):
    result, provider, _ = await invoke(
        monkeypatch,
        {
            "created": False,
            "status": "success",
            "result_id": "cached-1",
            "raw_result": {"ok": True},
        },
    )
    assert result["status"] == "cached"
    assert result["result_id"] == "cached-1"
    assert provider.calls == 0


@pytest.mark.asyncio
async def test_provider_failure_marks_reserved_action_failed(monkeypatch):
    result, provider, updates = await invoke(
        monkeypatch,
        {"created": True, "status": "pending"},
        ProviderTool(error=RuntimeError("provider failed")),
    )
    assert result["status"] == "error"
    assert provider.calls == 1
    assert updates[-1]["status"] == "failed"


def test_idempotency_key_is_fixed_length_digest():
    first = integration_tools._generate_idempotency_key(
        "11111111-1111-4111-8111-111111111111",
        "thread-1",
        "run-1",
        "gmail",
        "GMAIL_SEND_EMAIL",
        {"body": "héllo", "to": "person@example.test"},
    )
    second = integration_tools._generate_idempotency_key(
        "11111111-1111-4111-8111-111111111111",
        "thread-1",
        "run-1",
        "gmail",
        "GMAIL_SEND_EMAIL",
        {"to": "person@example.test", "body": "héllo"},
    )
    assert first == second
    assert len(first) == 64
    assert int(first, 16) >= 0


@pytest.mark.asyncio
async def test_stale_pending_action_requires_manual_reconciliation(monkeypatch):
    result, provider, _ = await invoke(
        monkeypatch,
        {"created": False, "status": "pending", "reserved_at": "2020-01-01T00:00:00Z"},
    )
    assert result["status"] == "in_progress"
    assert "reconciliation" in result["message"].lower()
    assert provider.calls == 0
