"""Shared rate windows, daily budgets, and token-safe concurrency leases."""

import asyncio
import ipaddress
import os
import secrets
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

from fastapi import HTTPException, Request


@dataclass(frozen=True)
class LimitDecision:
    allowed: bool
    retry_after: int = 0


class UsageStore(Protocol):
    async def increment_window(
        self, keys: list[str], limit: int, window_seconds: int
    ) -> LimitDecision: ...
    async def reserve_budget(self, key: str, units: int, limit: int, ttl_seconds: int) -> bool: ...
    async def acquire_lease(self, key: str, token: str, ttl_seconds: int) -> bool: ...
    async def release_lease(self, key: str, token: str) -> bool: ...


class MemoryUsageStore:
    """Single-process development store; share one instance in unit tests."""

    def __init__(self):
        self._values: dict[str, tuple[int | str, float]] = {}
        self._lock = asyncio.Lock()

    async def increment_window(
        self, keys: list[str], limit: int, window_seconds: int
    ) -> LimitDecision:
        async with self._lock:
            now = time.monotonic()
            counts = []
            retry_after = 0
            for key in keys:
                value, expiry = self._values.get(key, (0, now + window_seconds))
                if expiry <= now:
                    value, expiry = 0, now + window_seconds
                count = int(value) + 1
                self._values[key] = (count, expiry)
                counts.append(count)
                retry_after = max(retry_after, max(1, int(expiry - now)))
            return LimitDecision(all(count <= limit for count in counts), retry_after)

    async def reserve_budget(self, key: str, units: int, limit: int, ttl_seconds: int) -> bool:
        async with self._lock:
            now = time.monotonic()
            value, expiry = self._values.get(key, (0, now + ttl_seconds))
            if expiry <= now:
                value, expiry = 0, now + ttl_seconds
            next_value = int(value) + units
            if next_value > limit:
                return False
            self._values[key] = (next_value, expiry)
            return True

    async def acquire_lease(self, key: str, token: str, ttl_seconds: int) -> bool:
        async with self._lock:
            now = time.monotonic()
            current = self._values.get(key)
            if current and current[1] > now:
                return False
            self._values[key] = (token, now + ttl_seconds)
            return True

    async def release_lease(self, key: str, token: str) -> bool:
        async with self._lock:
            current = self._values.get(key)
            if not current or current[0] != token:
                return False
            del self._values[key]
            return True

    async def expire_all(self) -> None:
        async with self._lock:
            self._values = {key: (value, 0) for key, (value, _expiry) in self._values.items()}


class RedisUsageStore:
    _WINDOW_SCRIPT = """
local allowed = 1
local retry = 0
for i, key in ipairs(KEYS) do
  local count = redis.call('INCR', key)
  if count == 1 then redis.call('EXPIRE', key, ARGV[2]) end
  local ttl = redis.call('TTL', key)
  if ttl > retry then retry = ttl end
  if count > tonumber(ARGV[1]) then allowed = 0 end
end
return {allowed, retry}
"""
    _BUDGET_SCRIPT = """
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local next = current + tonumber(ARGV[1])
if next > tonumber(ARGV[2]) then return 0 end
redis.call('SET', KEYS[1], next, 'EX', ARGV[3])
return 1
"""
    _RELEASE_SCRIPT = """
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
"""

    def __init__(self, client):
        self.client = client

    async def increment_window(
        self, keys: list[str], limit: int, window_seconds: int
    ) -> LimitDecision:
        allowed, retry = await self.client.eval(
            self._WINDOW_SCRIPT, len(keys), *keys, limit, window_seconds
        )
        return LimitDecision(bool(allowed), max(1, int(retry)))

    async def reserve_budget(self, key: str, units: int, limit: int, ttl_seconds: int) -> bool:
        return bool(await self.client.eval(self._BUDGET_SCRIPT, 1, key, units, limit, ttl_seconds))

    async def acquire_lease(self, key: str, token: str, ttl_seconds: int) -> bool:
        return bool(await self.client.set(key, token, ex=ttl_seconds, nx=True))

    async def release_lease(self, key: str, token: str) -> bool:
        return bool(await self.client.eval(self._RELEASE_SCRIPT, 1, key, token))

    async def ping(self) -> bool:
        return bool(await self.client.ping())


class UsageLimiter:
    def __init__(self, store: UsageStore, namespace: str = "neloo"):
        self.store = store
        self.namespace = namespace

    def _key(self, *parts: str) -> str:
        return ":".join((self.namespace, *parts))

    async def consume(
        self,
        capability: str,
        guest_id: str,
        ip_address: str | None,
        *,
        limit: int,
        window_seconds: int,
    ) -> LimitDecision:
        window = str(int(time.time()) // window_seconds)
        keys = [self._key("window", capability, "guest", guest_id, window)]
        if ip_address:
            keys.append(self._key("window", capability, "ip", ip_address, window))
        return await self.store.increment_window(keys, limit, window_seconds)

    async def reserve_budget(self, guest_id: str, units: int, *, daily_limit: int) -> bool:
        day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return await self.store.reserve_budget(
            self._key("budget", guest_id, day), units, daily_limit, 172800
        )

    async def consume_ip(
        self, capability: str, ip_address: str, *, limit: int, window_seconds: int
    ) -> LimitDecision:
        window = str(int(time.time()) // window_seconds)
        key = self._key("window", capability, "ip", ip_address, window)
        return await self.store.increment_window([key], limit, window_seconds)

    async def acquire_lease(
        self, capability: str, guest_id: str, *, ttl_seconds: int
    ) -> str | None:
        token = secrets.token_urlsafe(24)
        key = self._key("lease", capability, guest_id)
        return token if await self.store.acquire_lease(key, token, ttl_seconds) else None

    async def release_lease(self, capability: str, guest_id: str, token: str) -> bool:
        return await self.store.release_lease(self._key("lease", capability, guest_id), token)


def build_usage_limiter() -> UsageLimiter:
    redis_url = os.environ.get("RATE_LIMIT_REDIS_URL", "").strip()
    environment = os.environ.get("ENVIRONMENT", "development").lower()
    namespace = os.environ.get("RATE_LIMIT_NAMESPACE", "neloo")
    if not redis_url:
        if environment == "production":
            raise RuntimeError("RATE_LIMIT_REDIS_URL is required in production")
        return UsageLimiter(MemoryUsageStore(), namespace)

    from redis.asyncio import from_url

    return UsageLimiter(RedisUsageStore(from_url(redis_url, decode_responses=True)), namespace)


_limiter: UsageLimiter | None = None


def get_usage_limiter() -> UsageLimiter:
    global _limiter
    if _limiter is None:
        _limiter = build_usage_limiter()
    return _limiter


def client_ip(request: Request) -> str | None:
    return _trusted_client_ip(
        request.client.host if request.client else None,
        request.headers.get("x-forwarded-for", ""),
    )


def _trusted_client_ip(peer: str | None, forwarded_value: str) -> str | None:
    hops = max(0, int(os.environ.get("TRUSTED_PROXY_HOPS", "0")))
    forwarded = [part.strip() for part in forwarded_value.split(",") if part.strip()]
    chain = [*forwarded, peer] if peer else forwarded
    candidate = chain[-(hops + 1)] if hops < len(chain) else peer
    try:
        return str(ipaddress.ip_address(candidate)) if candidate else None
    except ValueError:
        return None


def client_ip_from_scope(scope: dict | None) -> str | None:
    if not scope:
        return None
    client = scope.get("client")
    peer = client[0] if isinstance(client, (list, tuple)) and client else None
    forwarded = ""
    for key, value in scope.get("headers") or []:
        if key.decode("latin-1").lower() == "x-forwarded-for":
            forwarded = value.decode("latin-1")
            break
    return _trusted_client_ip(peer, forwarded)


async def enforce_ip_usage_limit(capability: str, ip_address: str | None) -> None:
    if not ip_address:
        return
    env_name = {
        "model": "MODEL_RUNS_PER_10_MINUTES",
        "image": "IMAGE_RUNS_PER_10_MINUTES",
        "e2b": "E2B_RUNS_PER_10_MINUTES",
    }.get(capability, "MODEL_RUNS_PER_10_MINUTES")
    limit = int(os.environ.get(env_name, "30"))
    decision = await get_usage_limiter().consume_ip(
        capability, ip_address, limit=limit, window_seconds=600
    )
    if not decision.allowed:
        raise HTTPException(
            status_code=429,
            detail="Usage limit exceeded",
            headers={"Retry-After": str(decision.retry_after)},
        )


async def enforce_guest_usage_limit(capability: str, guest_id: str, *, units: int = 1) -> None:
    limiter = get_usage_limiter()
    env_name = {
        "model": "MODEL_RUNS_PER_10_MINUTES",
        "image": "IMAGE_RUNS_PER_10_MINUTES",
        "e2b": "E2B_RUNS_PER_10_MINUTES",
        "integration": "MODEL_RUNS_PER_10_MINUTES",
    }.get(capability, "MODEL_RUNS_PER_10_MINUTES")
    decision = await limiter.consume(
        capability,
        guest_id,
        None,
        limit=int(os.environ.get(env_name, "30")),
        window_seconds=600,
    )
    if not decision.allowed:
        raise HTTPException(
            status_code=429,
            detail="Usage limit exceeded",
            headers={"Retry-After": str(decision.retry_after)},
        )
    if not await limiter.reserve_budget(
        guest_id,
        units,
        daily_limit=int(os.environ.get("DAILY_BUDGET_UNITS", "200")),
    ):
        raise HTTPException(
            status_code=429,
            detail="Daily usage budget exceeded",
            headers={"Retry-After": "3600"},
        )


async def enforce_usage_limit(
    capability: str,
    guest_id: str,
    *,
    request: Request | None = None,
    units: int = 1,
) -> None:
    await enforce_ip_usage_limit(capability, client_ip(request) if request else None)
    await enforce_guest_usage_limit(capability, guest_id, units=units)


async def usage_store_ready() -> bool:
    limiter = get_usage_limiter()
    if isinstance(limiter.store, RedisUsageStore):
        return await limiter.store.ping()
    return os.environ.get("ENVIRONMENT", "development").lower() != "production"


_sync_memory_lock = threading.Lock()
_sync_memory_windows: dict[str, tuple[int, float]] = {}
_sync_memory_budgets: dict[str, tuple[int, float]] = {}


def enforce_e2b_usage_limit_sync(guest_id: str, *, units: int = 1) -> None:
    """Enforce E2B limits before synchronous sandbox creation or execution."""
    namespace = os.environ.get("RATE_LIMIT_NAMESPACE", "neloo")
    limit = int(os.environ.get("E2B_RUNS_PER_10_MINUTES", "30"))
    budget_limit = int(os.environ.get("DAILY_BUDGET_UNITS", "200"))
    window_seconds = 600
    window = str(int(time.time()) // window_seconds)
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    window_key = f"{namespace}:window:e2b:guest:{guest_id}:{window}"
    budget_key = f"{namespace}:budget:{guest_id}:{day}"
    redis_url = os.environ.get("RATE_LIMIT_REDIS_URL", "").strip()

    if redis_url:
        from redis import Redis

        client = Redis.from_url(redis_url, decode_responses=True)
        allowed, retry = client.eval(
            RedisUsageStore._WINDOW_SCRIPT, 1, window_key, limit, window_seconds
        )
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail="Usage limit exceeded",
                headers={"Retry-After": str(max(1, int(retry)))},
            )
        if not client.eval(
            RedisUsageStore._BUDGET_SCRIPT, 1, budget_key, units, budget_limit, 172800
        ):
            raise HTTPException(
                status_code=429,
                detail="Daily usage budget exceeded",
                headers={"Retry-After": "3600"},
            )
        return

    if os.environ.get("ENVIRONMENT", "development").lower() == "production":
        raise RuntimeError("RATE_LIMIT_REDIS_URL is required in production")

    now = time.monotonic()
    with _sync_memory_lock:
        count, expiry = _sync_memory_windows.get(window_key, (0, now + window_seconds))
        if expiry <= now:
            count, expiry = 0, now + window_seconds
        count += 1
        _sync_memory_windows[window_key] = (count, expiry)
        if count > limit:
            raise HTTPException(
                status_code=429,
                detail="Usage limit exceeded",
                headers={"Retry-After": str(max(1, int(expiry - now)))},
            )
        budget, budget_expiry = _sync_memory_budgets.get(budget_key, (0, now + 172800))
        if budget_expiry <= now:
            budget, budget_expiry = 0, now + 172800
        if budget + units > budget_limit:
            raise HTTPException(
                status_code=429,
                detail="Daily usage budget exceeded",
                headers={"Retry-After": "3600"},
            )
        _sync_memory_budgets[budget_key] = (budget + units, budget_expiry)
