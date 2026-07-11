#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import ipaddress
import os
import socket
from collections.abc import Iterable
from urllib.parse import urlparse

from langgraph_sdk import get_client


class BackfillConflict(RuntimeError):
    pass


def _is_internal_address(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    private_networks = (
        ipaddress.ip_network("10.0.0.0/8"),
        ipaddress.ip_network("172.16.0.0/12"),
        ipaddress.ip_network("192.168.0.0/16"),
    )
    return ip.is_loopback or any(ip in network for network in private_networks)


def validate_internal_url(url: str) -> None:
    if os.environ.get("ALLOW_REMOTE_OWNER_BACKFILL", "false").lower() == "true":
        return
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("LangGraph URL must be an absolute HTTP URL")
    if parsed.hostname == "localhost":
        return
    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(parsed.hostname, None)}
    except socket.gaierror as exc:
        raise ValueError("Owner backfill requires a resolvable internal URL") from exc
    if not addresses or not all(_is_internal_address(address) for address in addresses):
        raise ValueError(
            "Owner backfill requires an internal URL; set "
            "ALLOW_REMOTE_OWNER_BACKFILL=true to allow a remote target"
        )


def _unique_mappings(records: Iterable[dict]) -> dict[str, str]:
    mappings: dict[str, str] = {}
    for record in records:
        thread_id = record.get("langgraph_thread_id")
        owner = record.get("user_id")
        if not isinstance(thread_id, str) or not thread_id:
            continue
        if not isinstance(owner, str) or not owner:
            raise BackfillConflict("Thread mapping has no owner")
        existing = mappings.get(thread_id)
        if existing is not None and existing != owner:
            raise BackfillConflict(f"Thread {thread_id} has multiple owners")
        mappings[thread_id] = owner
    return mappings


async def backfill_records(records: Iterable[dict], client, *, dry_run: bool) -> dict[str, int]:
    mappings = _unique_mappings(records)
    counts = {"updated": 0, "skipped": 0, "failed": 0}
    for thread_id, owner in mappings.items():
        try:
            thread = await client.threads.get(thread_id)
            metadata = dict(thread.get("metadata") or {})
            existing_owner = metadata.get("owner")
            if existing_owner == owner:
                counts["skipped"] += 1
                continue
            if existing_owner:
                raise BackfillConflict(
                    f"Thread {thread_id} already belongs to a different owner"
                )
            counts["updated"] += 1
            if not dry_run:
                metadata["owner"] = owner
                await client.threads.update(thread_id, metadata=metadata)
        except BackfillConflict:
            raise
        except Exception:
            counts["failed"] += 1
    return counts


async def _load_mappings(page_size: int) -> list[dict]:
    from src.storage.supabase_db import get_supabase_client

    supabase = await get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase service-role database is not configured")
    records: list[dict] = []
    offset = 0
    while True:
        response = await (
            supabase.table("threads")
            .select("user_id,langgraph_thread_id")
            .not_.is_("langgraph_thread_id", "null")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        page = response.data or []
        records.extend(page)
        if len(page) < page_size:
            return records
        offset += page_size


async def _run(args: argparse.Namespace) -> int:
    validate_internal_url(args.langgraph_url)
    token = os.environ.get("OWNER_BACKFILL_AUTH_TOKEN")
    headers = {"Authorization": f"Bearer {token}"} if token else None
    client = get_client(url=args.langgraph_url, headers=headers)
    records = await _load_mappings(args.page_size)
    counts = await backfill_records(records, client, dry_run=args.dry_run or args.check)
    print(
        "Thread owner backfill: "
        f"updated={counts['updated']} skipped={counts['skipped']} failed={counts['failed']}"
    )
    if counts["failed"]:
        return 1
    if args.check and counts["updated"]:
        print("Unowned legacy threads remain; run the backfill before release.")
        return 2
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill LangGraph thread owner metadata")
    parser.add_argument(
        "--langgraph-url",
        default=os.environ.get("LANGGRAPH_INTERNAL_URL", "http://127.0.0.1:2024"),
    )
    parser.add_argument("--page-size", type=int, default=500)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--check", action="store_true")
    return asyncio.run(_run(parser.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
