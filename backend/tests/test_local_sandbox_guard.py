"""Guest mode must not implicitly allow untrusted host code execution."""

import pytest

from src.sandbox.executor import LocalSubprocessExecutor


def test_guest_mode_alone_does_not_enable_local_code_execution(monkeypatch):
    monkeypatch.setenv("ALLOW_ANONYMOUS", "true")
    monkeypatch.delenv("ALLOW_LOCAL_SANDBOX", raising=False)

    with pytest.raises(RuntimeError):
        LocalSubprocessExecutor().execute("print(1)")
