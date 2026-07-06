"""Tests for local sandbox secret-stripping and opt-in guard (Task 2)."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import src.sandbox.executor as ex


def test_build_child_env_excludes_secrets(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-leak")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "jwt-leak")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-leak2")
    monkeypatch.setenv("DATABASE_URL", "postgres://leak")
    env = ex._build_child_env()
    for k in ("DEEPSEEK_API_KEY", "SUPABASE_JWT_SECRET", "OPENAI_API_KEY", "DATABASE_URL"):
        assert k not in env
    assert env["PYTHONIOENCODING"] == "utf-8"


def test_build_child_env_keeps_safe_keys(monkeypatch):
    monkeypatch.setenv("PATH", "/usr/bin")
    monkeypatch.setenv("HOME", "/tmp/x")
    monkeypatch.setenv("TZ", "Asia/Shanghai")
    env = ex._build_child_env()
    assert env["PATH"] == "/usr/bin"
    assert env["HOME"] == "/tmp/x"
    assert env["TZ"] == "Asia/Shanghai"


def test_local_mode_guard_requires_opt_in(monkeypatch):
    monkeypatch.setenv("SANDBOX_MODE", "local")
    monkeypatch.delenv("ALLOW_ANONYMOUS", raising=False)
    monkeypatch.delenv("ALLOW_LOCAL_SANDBOX", raising=False)
    ex._executor = None
    try:
        with pytest.raises(RuntimeError):
            ex.get_executor()
    finally:
        ex._executor = None


def test_local_mode_allowed_with_opt_in(monkeypatch):
    monkeypatch.setenv("SANDBOX_MODE", "local")
    monkeypatch.setenv("ALLOW_LOCAL_SANDBOX", "true")
    monkeypatch.delenv("ALLOW_ANONYMOUS", raising=False)
    ex._executor = None
    try:
        executor = ex.get_executor()
        assert executor.__class__.__name__ == "LocalSubprocessExecutor"
    finally:
        ex._executor = None
