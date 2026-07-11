from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from uuid import uuid4

import httpx
import pytest
from langgraph_sdk import get_client

BACKEND_ROOT = Path(__file__).resolve().parents[2]
TEST_SECRET = "test-anonymous-secret-at-least-32-bytes"  # gitleaks:allow


def _guest_token(identity: str) -> str:
    payload = json.dumps(
        {"sub": identity, "exp": int(time.time()) + 300}, separators=(",", ":")
    ).encode()
    encoded = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    signature = hmac.new(TEST_SECRET.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return f"neloo-anon-v1.{encoded}.{signature}"


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@pytest.fixture(scope="module")
def runtime_url():
    port = _free_port()
    env = os.environ.copy()
    env.update(
        {
            "ALLOW_ANONYMOUS": "true",
            "ALLOW_INSECURE_LOCAL_TOKENS": "false",
            "ANONYMOUS_SESSION_SECRET": TEST_SECRET,
            "DEEPSEEK_API_KEY": "test-runtime-auth-key",
        }
    )
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "langgraph_cli",
            "dev",
            "--config",
            "langgraph.json",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--no-browser",
        ],
        cwd=BACKEND_ROOT,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    url = f"http://127.0.0.1:{port}"
    deadline = time.monotonic() + 45
    try:
        while time.monotonic() < deadline:
            if process.poll() is not None:
                pytest.fail(f"LangGraph runtime exited with {process.returncode}")
            try:
                httpx.get(f"{url}/ok", timeout=0.5)
                break
            except httpx.HTTPError:
                time.sleep(0.2)
        else:
            pytest.fail("LangGraph runtime did not become ready")
        yield url
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


@pytest.mark.parametrize(
    ("method", "path", "headers"),
    [
        ("POST", "/threads/search", {}),
        ("POST", "/assistants/search", {}),
        ("POST", "/threads/search", {"Authorization": "Bearer invalid"}),
        ("GET", "/api/files", {}),
    ],
)
def test_runtime_rejects_unauthenticated_requests(
    runtime_url: str, method: str, path: str, headers: dict[str, str]
):
    response = httpx.request(
        method,
        f"{runtime_url}{path}",
        headers=headers,
        json={} if method == "POST" else None,
        timeout=5,
    )

    assert response.status_code == 401


def test_runtime_accepts_guest_and_filters_threads_by_owner(runtime_url: str):
    guest_a = str(uuid4())
    guest_b = str(uuid4())
    thread_id = str(uuid4())
    headers_a = {"Authorization": f"Bearer {_guest_token(guest_a)}"}
    headers_b = {"Authorization": f"Bearer {_guest_token(guest_b)}"}

    created = httpx.post(
        f"{runtime_url}/threads",
        headers=headers_a,
        json={"thread_id": thread_id, "metadata": {"owner": "spoofed"}},
        timeout=5,
    )
    assert created.status_code in {200, 201}
    assert created.json()["metadata"]["owner"] == guest_a

    run = httpx.post(
        f"{runtime_url}/threads/{thread_id}/runs",
        headers=headers_a,
        json={
            "assistant_id": "deepseek",
            "input": {"messages": [{"role": "user", "content": "hello"}]},
        },
        timeout=10,
    )
    assert run.status_code in {200, 201, 202}

    own_search = httpx.post(f"{runtime_url}/threads/search", headers=headers_a, json={}, timeout=5)
    other_search = httpx.post(
        f"{runtime_url}/threads/search", headers=headers_b, json={}, timeout=5
    )
    assert thread_id in {item["thread_id"] for item in own_search.json()}
    assert thread_id not in {item["thread_id"] for item in other_search.json()}

    denied_requests = [
        httpx.get(f"{runtime_url}/threads/{thread_id}", headers=headers_b, timeout=5),
        httpx.patch(
            f"{runtime_url}/threads/{thread_id}",
            headers=headers_b,
            json={"metadata": {"title": "hijacked"}},
            timeout=5,
        ),
        httpx.delete(f"{runtime_url}/threads/{thread_id}", headers=headers_b, timeout=5),
        httpx.post(
            f"{runtime_url}/threads/{thread_id}/runs",
            headers=headers_b,
            json={
                "assistant_id": "deepseek",
                "input": {"messages": [{"role": "user", "content": "hijack"}]},
            },
            timeout=5,
        ),
    ]
    assert all(response.status_code in {403, 404} for response in denied_requests)


def test_runtime_isolates_store_namespaces(runtime_url: str):
    guest_a = str(uuid4())
    guest_b = str(uuid4())

    async def exercise_store():
        client_a = get_client(
            url=runtime_url,
            headers={"Authorization": f"Bearer {_guest_token(guest_a)}"},
        )
        client_b = get_client(
            url=runtime_url,
            headers={"Authorization": f"Bearer {_guest_token(guest_b)}"},
        )
        await client_a.store.put_item(("shared",), "secret", {"owner": "a"})
        own_item = await client_a.store.get_item(("shared",), "secret")
        other_item = await client_b.store.get_item(("shared",), "secret")
        return own_item, other_item

    own_item, other_item = asyncio.run(exercise_store())
    assert own_item is not None
    assert own_item["value"] == {"owner": "a"}
    assert other_item is None


def test_oauth_callback_requires_state_and_is_reachable(runtime_url: str):
    missing_state = httpx.get(
        f"{runtime_url}/api/integrations/callback",
        params={"connectedAccountId": "account-1"},
        timeout=5,
    )
    assert missing_state.status_code == 422

    callback = httpx.get(
        f"{runtime_url}/api/integrations/callback",
        params={"connectedAccountId": "account-1", "state": "invalid-state"},
        follow_redirects=False,
        timeout=5,
    )
    assert callback.status_code == 302
    assert "error=db_error" in callback.headers["location"]
