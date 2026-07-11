from __future__ import annotations

from dataclasses import dataclass, field

import pytest

from scripts.backfill_langgraph_thread_owners import (
    BackfillConflict,
    backfill_records,
    validate_internal_url,
)


@dataclass
class _Threads:
    metadata: dict[str, dict] = field(default_factory=dict)
    updates: list[tuple[str, dict]] = field(default_factory=list)

    async def get(self, thread_id: str):
        return {"thread_id": thread_id, "metadata": self.metadata.get(thread_id, {})}

    async def update(self, thread_id: str, *, metadata: dict):
        self.updates.append((thread_id, metadata))
        self.metadata[thread_id] = metadata


@dataclass
class _Client:
    threads: _Threads


@pytest.mark.asyncio
async def test_backfill_is_dry_run_and_idempotent():
    threads = _Threads(metadata={"owned": {"owner": "guest-a"}})
    records = [
        {"user_id": "guest-a", "langgraph_thread_id": "legacy"},
        {"user_id": "guest-a", "langgraph_thread_id": "owned"},
    ]

    dry_result = await backfill_records(records, _Client(threads), dry_run=True)
    assert dry_result == {"updated": 1, "skipped": 1, "failed": 0}
    assert threads.updates == []

    result = await backfill_records(records, _Client(threads), dry_run=False)
    assert result == {"updated": 1, "skipped": 1, "failed": 0}
    assert threads.updates == [("legacy", {"owner": "guest-a"})]

    repeated = await backfill_records(records, _Client(threads), dry_run=False)
    assert repeated == {"updated": 0, "skipped": 2, "failed": 0}


@pytest.mark.asyncio
async def test_duplicate_owner_mapping_stops_without_updates():
    threads = _Threads()
    records = [
        {"user_id": "guest-a", "langgraph_thread_id": "same"},
        {"user_id": "guest-b", "langgraph_thread_id": "same"},
    ]

    with pytest.raises(BackfillConflict, match="multiple owners"):
        await backfill_records(records, _Client(threads), dry_run=False)

    assert threads.updates == []


@pytest.mark.asyncio
async def test_existing_different_owner_stops_without_overwrite():
    threads = _Threads(metadata={"legacy": {"owner": "guest-b"}})
    records = [{"user_id": "guest-a", "langgraph_thread_id": "legacy"}]

    with pytest.raises(BackfillConflict, match="already belongs"):
        await backfill_records(records, _Client(threads), dry_run=False)

    assert threads.updates == []


def test_remote_backfill_requires_explicit_opt_in(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("ALLOW_REMOTE_OWNER_BACKFILL", raising=False)

    with pytest.raises(ValueError, match="internal URL"):
        validate_internal_url("https://api.example.com")

    validate_internal_url("http://127.0.0.1:8123")
    validate_internal_url("http://10.20.30.40:8123")

    monkeypatch.setenv("ALLOW_REMOTE_OWNER_BACKFILL", "true")
    validate_internal_url("https://api.example.com")
