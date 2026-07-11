"""Composio configuration must come from the instance operator, not repository defaults."""

import pytest
from fastapi import HTTPException

from src.api import composio_routes


def test_composio_auth_configs_are_operator_configured(monkeypatch):
    monkeypatch.setenv(
        "COMPOSIO_AUTH_CONFIGS_JSON",
        '{"GitHub":"ac_operator_github","gmail":"ac_operator_gmail"}',
    )

    assert composio_routes.get_app_auth_configs() == {
        "github": "ac_operator_github",
        "gmail": "ac_operator_gmail",
    }


def test_composio_rejects_invalid_config_json(monkeypatch):
    monkeypatch.setenv("COMPOSIO_AUTH_CONFIGS_JSON", "not-json")

    with pytest.raises(HTTPException) as error:
        composio_routes.get_app_auth_configs()
    assert error.value.status_code == 503
