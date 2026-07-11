"""Default-deny policy tests for connected application actions."""

import os

import pytest

os.environ.setdefault("DEEPSEEK_API_KEY", "test-deepseek-key")

from src.agent import integration_policy


def test_unconfigured_action_is_denied(monkeypatch):
    monkeypatch.delenv("COMPOSIO_ALLOWED_ACTIONS_JSON", raising=False)
    assert integration_policy.classify_action("gmail", "GMAIL_FETCH_EMAILS") is None


def test_action_must_belong_to_configured_app(monkeypatch):
    monkeypatch.setenv(
        "COMPOSIO_ALLOWED_ACTIONS_JSON",
        '{"gmail":{"read":["GMAIL_FETCH_EMAILS"],"write":["GMAIL_SEND_EMAIL"]}}',
    )
    assert integration_policy.classify_action("notion", "GMAIL_FETCH_EMAILS") is None


def test_write_action_requires_approval_classification(monkeypatch):
    monkeypatch.setenv(
        "COMPOSIO_ALLOWED_ACTIONS_JSON",
        '{"gmail":{"read":[],"write":["GMAIL_SEND_EMAIL"]}}',
    )
    assert integration_policy.classify_action("gmail", "gmail_send_email") == "write"


def test_unknown_action_never_defaults_to_read_only(monkeypatch):
    monkeypatch.setenv(
        "COMPOSIO_ALLOWED_ACTIONS_JSON",
        '{"gmail":{"read":["GMAIL_FETCH_EMAILS"],"write":[]}}',
    )
    assert integration_policy.classify_action("gmail", "GMAIL_UNKNOWN") is None


@pytest.mark.asyncio
async def test_read_action_is_rejected_by_write_tool(monkeypatch):
    monkeypatch.setenv(
        "COMPOSIO_ALLOWED_ACTIONS_JSON",
        '{"gmail":{"read":["GMAIL_FETCH_EMAILS"],"write":[]}}',
    )
    from src.agent.integration_tools import integrations_execute

    result = await integrations_execute.ainvoke(
        {"app_name": "gmail", "action": "GMAIL_FETCH_EMAILS", "params": {}},
        config={"configurable": {"langgraph_auth_user_id": "user-1", "thread_id": "thread-1"}},
    )
    assert result["status"] == "denied"


@pytest.mark.asyncio
async def test_write_action_is_rejected_by_read_tool(monkeypatch):
    monkeypatch.setenv(
        "COMPOSIO_ALLOWED_ACTIONS_JSON",
        '{"gmail":{"read":[],"write":["GMAIL_SEND_EMAIL"]}}',
    )
    from src.agent.integration_tools import integrations_query

    result = await integrations_query.ainvoke(
        {"app_name": "gmail", "action": "GMAIL_SEND_EMAIL", "params": {}},
        config={"configurable": {"langgraph_auth_user_id": "user-1", "thread_id": "thread-1"}},
    )
    assert result["status"] == "denied"


def test_write_tool_is_in_hitl_and_read_tool_is_not():
    from src.agent.graph import INTERRUPT_ON_CONFIG, hitl_enabled

    assert "integrations_execute" in INTERRUPT_ON_CONFIG
    assert "integrations_query" not in INTERRUPT_ON_CONFIG
    assert hitl_enabled({"ENABLE_HITL": "false"})
    assert not hitl_enabled(
        {
            "ENVIRONMENT": "development",
            "ALLOW_INSECURE_LOCAL_TOKENS": "true",
            "ENABLE_HITL": "false",
        }
    )
