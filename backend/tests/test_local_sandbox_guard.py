"""Guest mode must not implicitly allow untrusted host code execution."""

import pytest

from src.sandbox.executor import LocalSubprocessExecutor


def test_guest_mode_alone_does_not_enable_local_code_execution(monkeypatch):
    monkeypatch.setenv("ALLOW_ANONYMOUS", "true")
    monkeypatch.delenv("ALLOW_LOCAL_SANDBOX", raising=False)

    with pytest.raises(RuntimeError):
        LocalSubprocessExecutor().execute("print(1)")


def test_guest_mode_rejects_local_sandbox_even_with_opt_in(monkeypatch):
    """Even if the operator sets ALLOW_LOCAL_SANDBOX=true, guest mode must not
    execute code on the host. The guest gate fires after the opt-in gate."""
    monkeypatch.setenv("ALLOW_ANONYMOUS", "true")
    monkeypatch.setenv("ALLOW_LOCAL_SANDBOX", "true")

    with pytest.raises(RuntimeError, match="ALLOW_ANONYMOUS"):
        LocalSubprocessExecutor().execute("print(1)")
