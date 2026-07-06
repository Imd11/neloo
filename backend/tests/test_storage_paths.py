"""Tests for local-storage path containment (Task 3)."""
import os
import sys

# webapp transitively builds a chat model at import; a dummy key lets us import
# it to reach the pure _safe_join helper. Removed once T10 makes models lazy.
os.environ.setdefault("DEEPSEEK_API_KEY", "test-dummy-key-for-import")

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.api.webapp import _safe_join


def test_safe_join_rejects_traversal(tmp_path):
    for bad in ("../../etc/passwd", "a/b.txt", "..\\x", "", "/abs.txt"):
        with pytest.raises(HTTPException):
            _safe_join(tmp_path, bad)


def test_safe_join_accepts_plain(tmp_path):
    p = _safe_join(tmp_path, "report.csv")
    assert p.parent == tmp_path.resolve()


def test_safe_join_resolves_within_base(tmp_path):
    # a sneaky unicode/percent-style name without separators is allowed
    p = _safe_join(tmp_path, "café_数据.csv")
    assert p.parent == tmp_path.resolve()
