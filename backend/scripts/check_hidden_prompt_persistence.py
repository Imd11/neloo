#!/usr/bin/env python3
"""Check durable hidden prompt persistence paths against a running Neloo backend."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from typing import Any

import httpx
from langgraph_sdk import get_client


FORBIDDEN = [
    "You are a senior prompt engineer.",
    "Act like a professional content writer",
    "Analysis direction:",
    "[System: You are now acting as the agent",
]

USER_ID = "hidden-prompt-regression-user"


def contains_forbidden(value: Any) -> bool:
    text = json.dumps(value, ensure_ascii=False, sort_keys=True)
    return any(marker in text for marker in FORBIDDEN)


def request_json(client: httpx.Client, method: str, path: str, **kwargs: Any) -> tuple[int, Any]:
    response = client.request(method, path, **kwargs)
    try:
        body = response.json()
    except json.JSONDecodeError:
        body = response.text
    return response.status_code, body


async def seed_langgraph_state(base_url: str, thread_id: str, messages: list[dict[str, Any]]) -> None:
    client = get_client(url=base_url)
    await client.threads.create(thread_id=thread_id, if_exists="do_nothing")
    await client.threads.update_state(thread_id, {"messages": messages})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:2024")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    thread_id = str(uuid.uuid4())
    hidden_user_message = {
        "id": "human-1",
        "type": "human",
        "content": "You are a senior prompt engineer.\n\nsecret template\n\nmake a hero prompt",
        "additional_kwargs": {
            "neloo_hidden_prompt": {
                "visibleContent": "make a hero prompt",
                "context": {"feature": "prompt-optimize", "templateId": 1},
            }
        },
    }
    assistant_message = {
        "id": "ai-1",
        "type": "ai",
        "content": "Here is a concise optimized prompt.",
    }
    headers = {"x-user-id": USER_ID}

    with httpx.Client(base_url=base_url, timeout=20.0, headers=headers) as client:
        status, body = request_json(
            client,
            "POST",
            "/api/threads",
            json={
                "langgraph_thread_id": thread_id,
                "title": "Hidden prompt persistence check",
                "mode": "default",
                "model_id": "deepseek",
            },
        )
        if status == 503:
            print(f"SKIP: durable thread persistence unavailable: {body}")
            return 2
        if status >= 400:
            print(f"FAIL: failed to create thread ({status}): {body}")
            return 1
        if contains_forbidden(body):
            print("FAIL: create thread response exposed a forbidden hidden prompt marker")
            return 1

        for role, message in (("user", hidden_user_message), ("assistant", assistant_message)):
            status, body = request_json(
                client,
                "POST",
                f"/api/threads/{thread_id}/messages",
                json={
                    "message_id": message["id"],
                    "role": role,
                    "message_data": message,
                },
            )
            if status >= 400:
                print(f"FAIL: failed to save {role} message ({status}): {body}")
                return 1
            if contains_forbidden(body):
                print(f"FAIL: save {role} response exposed a forbidden hidden prompt marker")
                return 1

        status, body = request_json(client, "GET", f"/api/threads/{thread_id}")
        if status >= 400:
            print(f"FAIL: failed to read thread metadata ({status}): {body}")
            return 1
        if contains_forbidden(body):
            print("FAIL: thread metadata response exposed a forbidden hidden prompt marker")
            return 1

        try:
            asyncio.run(seed_langgraph_state(base_url, thread_id, [hidden_user_message, assistant_message]))
        except Exception as exc:
            print(f"FAIL: failed to seed LangGraph state for share verification: {type(exc).__name__}: {exc}")
            return 1

        status, body = request_json(
            client,
            "POST",
            f"/api/threads/{thread_id}/share",
            json={"target_ai_message_id": "ai-1"},
        )
        if status >= 400:
            print(f"FAIL: failed to create share ({status}): {body}")
            return 1
        if contains_forbidden(body):
            print("FAIL: share creation response exposed a forbidden hidden prompt marker")
            return 1

        share_id = body.get("share_id")
        status, body = request_json(client, "GET", f"/api/share/{share_id}")
        if status >= 400:
            print(f"FAIL: failed to read share ({status}): {body}")
            return 1
        if contains_forbidden(body):
            print("FAIL: shared conversation response exposed a forbidden hidden prompt marker")
            return 1
        messages = body.get("messages", [])
        if messages and messages[0].get("content") != "make a hero prompt":
            print(f"FAIL: shared user message was not sanitized: {messages[0]!r}")
            return 1

        status, body = request_json(
            client,
            "POST",
            f"/api/threads/{thread_id}/fork",
            json={"fork_target_ai_message_id": "ai-1"},
        )
        if status >= 400:
            print(f"FAIL: failed to fork thread ({status}): {body}")
            return 1
        if contains_forbidden(body):
            print("FAIL: fork response exposed a forbidden hidden prompt marker")
            return 1

    print("PASS: durable hidden prompt persistence APIs did not expose forbidden markers")
    return 0


if __name__ == "__main__":
    sys.exit(main())
