"""Shared usage window, budget, and lease safety tests."""

import os

import pytest

os.environ.setdefault("DEEPSEEK_API_KEY", "test-deepseek-key")

from src import usage_limits


@pytest.mark.asyncio
async def test_same_guest_limit_is_shared_between_instances():
    store = usage_limits.MemoryUsageStore()
    first = usage_limits.UsageLimiter(store, namespace="test")
    second = usage_limits.UsageLimiter(store, namespace="test")

    assert (await first.consume("model", "guest-1", "192.0.2.1", limit=2, window_seconds=600)).allowed
    assert (await second.consume("model", "guest-1", "192.0.2.1", limit=2, window_seconds=600)).allowed
    assert not (await first.consume("model", "guest-1", "192.0.2.1", limit=2, window_seconds=600)).allowed


@pytest.mark.asyncio
async def test_guest_and_ip_are_both_enforced():
    store = usage_limits.MemoryUsageStore()
    limiter = usage_limits.UsageLimiter(store, namespace="test")

    assert (await limiter.consume("image", "guest-1", "192.0.2.1", limit=1, window_seconds=600)).allowed
    assert not (await limiter.consume("image", "guest-2", "192.0.2.1", limit=1, window_seconds=600)).allowed


@pytest.mark.asyncio
async def test_daily_budget_reservation_is_atomic():
    store = usage_limits.MemoryUsageStore()
    limiter = usage_limits.UsageLimiter(store, namespace="test")

    assert await limiter.reserve_budget("guest-1", 3, daily_limit=5)
    assert not await limiter.reserve_budget("guest-1", 3, daily_limit=5)


def test_production_rejects_memory_only_storage(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("RATE_LIMIT_REDIS_URL", raising=False)
    with pytest.raises(RuntimeError):
        usage_limits.build_usage_limiter()


@pytest.mark.asyncio
async def test_denied_request_never_calls_provider():
    store = usage_limits.MemoryUsageStore()
    limiter = usage_limits.UsageLimiter(store, namespace="test")
    provider_calls = 0

    await limiter.consume("model", "guest-1", "192.0.2.1", limit=1, window_seconds=600)
    decision = await limiter.consume("model", "guest-1", "192.0.2.1", limit=1, window_seconds=600)
    if decision.allowed:
        provider_calls += 1

    assert provider_calls == 0


@pytest.mark.asyncio
async def test_old_lease_cannot_release_reacquired_slot():
    store = usage_limits.MemoryUsageStore()
    limiter = usage_limits.UsageLimiter(store, namespace="test")
    old = await limiter.acquire_lease("image", "guest-1", ttl_seconds=1)
    assert old
    await store.expire_all()
    current = await limiter.acquire_lease("image", "guest-1", ttl_seconds=30)
    assert current and current != old
    assert not await limiter.release_lease("image", "guest-1", old)
    assert await limiter.release_lease("image", "guest-1", current)


def test_e2b_limit_runs_before_executor_creation(monkeypatch):
    from src.sandbox import executor

    calls = 0

    def denied(_guest_id: str, *, units: int = 1):
        raise usage_limits.HTTPException(status_code=429, detail="Usage limit exceeded")

    def provider():
        nonlocal calls
        calls += 1

    monkeypatch.setenv("SANDBOX_MODE", "e2b")
    monkeypatch.setattr(usage_limits, "enforce_e2b_usage_limit_sync", denied)
    monkeypatch.setattr(executor, "get_executor", provider)

    with pytest.raises(usage_limits.HTTPException) as error:
        executor.execute_python("print(1)", user_id="guest-1")
    assert error.value.status_code == 429
    assert calls == 0
