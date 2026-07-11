from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest


BACKEND_ROOT = Path(__file__).resolve().parents[2]


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
            "ANONYMOUS_SESSION_SECRET": "test-anonymous-secret-at-least-32-bytes",
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
