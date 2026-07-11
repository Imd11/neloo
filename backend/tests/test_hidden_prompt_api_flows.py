import os
import sys
from types import SimpleNamespace

from fastapi.testclient import TestClient


def set_test_env_default(name, value):
    if not os.environ.get(name):
        os.environ[name] = value


set_test_env_default("DEEPSEEK_API_KEY", "test-deepseek-key")
set_test_env_default("SANDBOX_MODE", "local")
# These tests exercise prompt/thread flows (not auth) via TestClient; enable the
# anonymous local-dev path so authenticated routes accept the requests.
set_test_env_default("ALLOW_ANONYMOUS", "true")
set_test_env_default("ALLOW_INSECURE_LOCAL_TOKENS", "true")
set_test_env_default("ALLOW_LOCAL_SANDBOX", "true")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.api import webapp
from src.storage import supabase_db

HIDDEN_USER_MESSAGE = {
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


LEGACY_USER_MESSAGE = {
    "id": "human-legacy",
    "type": "human",
    "content": (
        "You are a senior prompt engineer.\n\n"
        "- Do not answer the user's task. Only return the improved prompt."
        "make a hero prompt"
    ),
}


def make_client(monkeypatch):
    monkeypatch.setattr(webapp, "USE_SUPABASE_DB", True)
    return TestClient(webapp.app)


def thread_record(thread_id="thread-1", user_id="hidden-prompt-test-user"):
    return {
        "id": "db-thread-1",
        "user_id": user_id,
        "title": "Hidden prompt regression",
        "langgraph_thread_id": thread_id,
        "mode": "default",
        "model_id": "deepseek",
        "created_at": "2026-07-05T00:00:00Z",
        "updated_at": "2026-07-05T00:00:00Z",
    }


def test_create_thread_api_returns_durable_thread(monkeypatch):
    client = make_client(monkeypatch)

    async def fake_get_thread_by_langgraph_id(_thread_id):
        return None

    async def fake_create_thread(**kwargs):
        return thread_record(kwargs["langgraph_thread_id"], kwargs["user_id"])

    async def fake_ensure_runtime_thread(*_args, **_kwargs):
        return True

    monkeypatch.setattr(webapp, "get_thread_by_langgraph_id", fake_get_thread_by_langgraph_id)
    monkeypatch.setattr(webapp, "create_thread", fake_create_thread)
    monkeypatch.setattr(webapp, "_ensure_langgraph_runtime_thread", fake_ensure_runtime_thread)

    response = client.post(
        "/api/threads",
        headers={"x-user-id": "hidden-prompt-test-user"},
        json={
            "langgraph_thread_id": "thread-1",
            "title": "Hidden prompt regression",
            "mode": "default",
            "model_id": "deepseek",
        },
    )

    assert response.status_code == 200
    assert response.json()["langgraph_thread_id"] == "thread-1"
    assert response.json()["user_id"] == "hidden-prompt-test-user"


def test_create_thread_api_reports_persistence_unavailable(monkeypatch):
    client = make_client(monkeypatch)

    async def fake_get_thread_by_langgraph_id(_thread_id):
        return None

    async def fake_create_thread(**_kwargs):
        return None

    monkeypatch.setattr(webapp, "get_thread_by_langgraph_id", fake_get_thread_by_langgraph_id)
    monkeypatch.setattr(webapp, "create_thread", fake_create_thread)

    response = client.post(
        "/api/threads",
        headers={"x-user-id": "hidden-prompt-test-user"},
        json={
            "langgraph_thread_id": "thread-1",
            "title": "Hidden prompt regression",
            "mode": "default",
            "model_id": "deepseek",
        },
    )

    assert response.status_code == 503
    assert "SUPABASE_URL" in response.json()["detail"]


def test_save_thread_message_sanitizes_hidden_prompt_envelope(monkeypatch):
    client = make_client(monkeypatch)
    saved = {}

    async def fake_get_thread_by_langgraph_id(thread_id):
        return thread_record(thread_id)

    async def fake_save_chat_message(**kwargs):
        saved.update(kwargs)
        return {"seq": 1}

    monkeypatch.setattr(webapp, "get_thread_by_langgraph_id", fake_get_thread_by_langgraph_id)
    monkeypatch.setattr(webapp, "save_chat_message", fake_save_chat_message)

    response = client.post(
        "/api/threads/thread-1/messages",
        headers={"x-user-id": "hidden-prompt-test-user"},
        json={
            "message_id": "human-1",
            "role": "user",
            "message_data": HIDDEN_USER_MESSAGE,
        },
    )

    assert response.status_code == 200
    assert saved["message_data"]["content"] == "make a hero prompt"
    assert "You are a senior prompt engineer" not in repr(saved["message_data"])


def test_save_thread_message_strips_legacy_hidden_prompt(monkeypatch):
    client = make_client(monkeypatch)
    saved = {}

    async def fake_get_thread_by_langgraph_id(thread_id):
        return thread_record(thread_id)

    async def fake_save_chat_message(**kwargs):
        saved.update(kwargs)
        return {"seq": 1}

    monkeypatch.setattr(webapp, "get_thread_by_langgraph_id", fake_get_thread_by_langgraph_id)
    monkeypatch.setattr(webapp, "save_chat_message", fake_save_chat_message)

    response = client.post(
        "/api/threads/thread-1/messages",
        headers={"x-user-id": "hidden-prompt-test-user"},
        json={
            "message_id": "human-legacy",
            "role": "user",
            "message_data": LEGACY_USER_MESSAGE,
        },
    )

    assert response.status_code == 200
    assert saved["message_data"]["content"] == "make a hero prompt"
    assert "You are a senior prompt engineer" not in repr(saved["message_data"])


def test_shared_conversation_sanitizes_langgraph_state(monkeypatch):
    client = make_client(monkeypatch)

    async def fake_get_share_by_id(_share_id):
        return {
            "share_id": "share-1",
            "thread_id": "thread-1",
            "user_id": "hidden-prompt-test-user",
            "created_at": "2026-07-05T00:00:00Z",
            "target_ai_message_id": None,
        }

    async def fake_get_thread_by_langgraph_id(thread_id):
        return thread_record(thread_id)

    class FakeThreads:
        async def get_state(self, _thread_id):
            return {"values": {"messages": [HIDDEN_USER_MESSAGE]}}

    def fake_get_client(*_args, **_kwargs):
        return SimpleNamespace(threads=FakeThreads())

    async def fake_load_db_messages(_thread_id):
        return [HIDDEN_USER_MESSAGE]

    monkeypatch.setattr(supabase_db, "get_share_by_id", fake_get_share_by_id)
    monkeypatch.setattr(webapp, "get_thread_by_langgraph_id", fake_get_thread_by_langgraph_id)
    monkeypatch.setattr(webapp, "_load_db_messages_for_history", fake_load_db_messages)
    monkeypatch.setattr("langgraph_sdk.get_client", fake_get_client)

    response = client.get("/api/share/share-1")

    assert response.status_code == 200
    body = response.json()
    assert body["messages"][0]["content"] == "make a hero prompt"
    assert "You are a senior prompt engineer" not in repr(body)


def test_shared_single_message_truncates_messages_after_the_target(monkeypatch):
    client = make_client(monkeypatch)

    async def fake_get_share_by_id(_share_id):
        return {
            "share_id": "share-1",
            "thread_id": "thread-1",
            "user_id": "hidden-prompt-test-user",
            "created_at": "2026-07-05T00:00:00Z",
            "target_ai_message_id": "ai-1",
        }

    async def fake_get_thread_by_langgraph_id(thread_id):
        return thread_record(thread_id)

    class FakeThreads:
        async def get_state(self, _thread_id):
            return {
                "values": {
                    "messages": [
                        {"id": "human-1", "type": "human", "content": "First question"},
                        {"id": "ai-1", "type": "ai", "content": "First answer"},
                        {"id": "human-2", "type": "human", "content": "Private follow-up"},
                    ]
                }
            }

    def fake_get_client(*_args, **_kwargs):
        return SimpleNamespace(threads=FakeThreads())

    async def fake_load_db_messages(_thread_id):
        return [
            {"id": "human-1", "type": "human", "content": "First question"},
            {"id": "ai-1", "type": "ai", "content": "First answer"},
            {"id": "human-2", "type": "human", "content": "Private follow-up"},
        ]

    monkeypatch.setattr(supabase_db, "get_share_by_id", fake_get_share_by_id)
    monkeypatch.setattr(webapp, "get_thread_by_langgraph_id", fake_get_thread_by_langgraph_id)
    monkeypatch.setattr(webapp, "_load_db_messages_for_history", fake_load_db_messages)
    monkeypatch.setattr("langgraph_sdk.get_client", fake_get_client)

    response = client.get("/api/share/share-1")

    assert response.status_code == 200
    body = response.json()
    assert [message["content"] for message in body["messages"]] == [
        "First question",
        "First answer",
    ]
    assert body["target_ai_message_id"] == "ai-1"


def test_fork_thread_copies_sanitized_chat_messages(monkeypatch):
    client = make_client(monkeypatch)
    copied_args = {}

    async def fake_get_thread_by_langgraph_id(thread_id):
        return thread_record(thread_id)

    async def fake_get_chat_messages(_thread_id):
        return [
            {
                "message_id": "human-1",
                "role": "user",
                "seq": 1,
                "message_data": {"content": "make a hero prompt", "type": "human"},
            },
            {
                "message_id": "ai-1",
                "role": "assistant",
                "seq": 2,
                "message_data": {"content": "assistant response", "type": "ai"},
            },
        ]

    async def fake_create_thread_with_fork(**kwargs):
        return thread_record(kwargs["langgraph_thread_id"], kwargs["user_id"])

    async def fake_copy_messages_to_thread(**kwargs):
        copied_args.update(kwargs)
        return 1

    monkeypatch.setattr(webapp, "get_thread_by_langgraph_id", fake_get_thread_by_langgraph_id)
    monkeypatch.setattr(supabase_db, "get_chat_messages", fake_get_chat_messages)
    monkeypatch.setattr(supabase_db, "create_thread_with_fork", fake_create_thread_with_fork)
    monkeypatch.setattr(supabase_db, "copy_messages_to_thread", fake_copy_messages_to_thread)

    response = client.post(
        "/api/threads/thread-1/fork",
        headers={"x-user-id": "hidden-prompt-test-user"},
        json={"fork_target_ai_message_id": "ai-1"},
    )

    assert response.status_code == 200
    assert response.json()["fork_anchor_human_message_id"] == "human-1"
    assert copied_args["source_thread_id"] == "thread-1"
    assert copied_args["up_to_seq"] == 1
