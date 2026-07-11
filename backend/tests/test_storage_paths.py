"""Tests for local-storage path containment (Task 3)."""

import os
import sys

# webapp transitively builds a chat model at import; a dummy key lets us import
# it to reach the pure _safe_join helper. Removed once T10 makes models lazy.
os.environ.setdefault("DEEPSEEK_API_KEY", "test-dummy-key-for-import")

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.api import auth, webapp
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


def test_local_storage_path_is_isolated_by_guest_identity(monkeypatch, tmp_path):
    monkeypatch.setattr(webapp, "LOCAL_STORAGE_DIR", tmp_path)

    assert webapp.get_local_storage_path("guest-a").parent == tmp_path
    assert webapp.get_local_storage_path("guest-a") != webapp.get_local_storage_path("guest-b")


def test_local_library_lists_downloads_and_deletes_only_the_current_guest_file(
    monkeypatch, tmp_path
):
    monkeypatch.setenv("ALLOW_ANONYMOUS", "true")
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_TOKENS", "true")
    auth.allow_anonymous.cache_clear()
    monkeypatch.setattr(webapp, "USE_SUPABASE_DB", False)
    monkeypatch.setattr(webapp, "LOCAL_STORAGE_DIR", tmp_path)

    user_id = "2f582f98-dbf6-4d9d-a05e-89f99d6415f8"
    filename = "20260711_120000_abcd1234_report.csv"
    user_dir = webapp.get_local_storage_path(user_id)
    user_dir.mkdir(parents=True)
    (user_dir / filename).write_text("name,value\nNeloo,1\n", encoding="utf-8")

    client = TestClient(webapp.app)
    headers = {"Authorization": f"Bearer local-dev:{user_id}"}

    listed = client.get("/api/files", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["files"][0]["id"] == filename

    downloaded = client.get(f"/api/files/{filename}/download", headers=headers)
    assert downloaded.status_code == 200
    assert downloaded.text == "name,value\nNeloo,1\n"

    deleted = client.delete(f"/api/files/{filename}", headers=headers)
    assert deleted.status_code == 200
    assert not (user_dir / filename).exists()


def test_legacy_sandbox_routes_are_scoped_to_current_guest(monkeypatch, tmp_path):
    monkeypatch.setenv("ALLOW_ANONYMOUS", "true")
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_TOKENS", "true")
    auth.allow_anonymous.cache_clear()
    monkeypatch.setattr(webapp, "LOCAL_STORAGE_DIR", tmp_path)

    guest_a = "2f582f98-dbf6-4d9d-a05e-89f99d6415f8"
    guest_b = "fa46c63f-cd11-47fd-8038-a3f6af20ebcc"
    for guest_id, content in ((guest_a, "a"), (guest_b, "b")):
        user_dir = webapp.get_local_storage_path(guest_id)
        user_dir.mkdir(parents=True)
        (user_dir / "report.txt").write_text(content, encoding="utf-8")

    client = TestClient(webapp.app)
    headers = {"Authorization": f"Bearer local-dev:{guest_a}"}
    listed = client.get("/sandbox/files", headers=headers)
    downloaded = client.get("/sandbox/files/report.txt", headers=headers)

    assert listed.status_code == 200
    assert [item["filename"] for item in listed.json()["files"]] == ["report.txt"]
    assert downloaded.status_code == 200
    assert downloaded.text == "a"
