"""Pure, default-deny policy for connected application actions."""

import json
import os
from typing import Literal


ActionClass = Literal["read", "write", "sensitive"]
_SENSITIVE_MARKERS = ("DELETE", "REMOVE", "PAY", "PURCHASE", "TRANSFER")


def _normalize_action(value: str) -> str:
    return value.strip().upper()


def load_allowed_actions(raw: str | None = None) -> dict[str, dict[str, frozenset[str]]]:
    """Parse the operator allowlist; invalid input denies every action."""
    value = os.environ.get("COMPOSIO_ALLOWED_ACTIONS_JSON", "") if raw is None else raw
    if not value.strip():
        return {}
    try:
        parsed = json.loads(value)
        if not isinstance(parsed, dict):
            return {}
        policy: dict[str, dict[str, frozenset[str]]] = {}
        for app_name, groups in parsed.items():
            if not isinstance(app_name, str) or not isinstance(groups, dict):
                return {}
            if set(groups) - {"read", "write"}:
                return {}
            read = groups.get("read", [])
            write = groups.get("write", [])
            if not isinstance(read, list) or not isinstance(write, list):
                return {}
            if not all(isinstance(action, str) and action.strip() for action in [*read, *write]):
                return {}
            normalized_read = frozenset(_normalize_action(action) for action in read)
            normalized_write = frozenset(_normalize_action(action) for action in write)
            if normalized_read & normalized_write:
                return {}
            policy[app_name.strip().lower()] = {
                "read": normalized_read,
                "write": normalized_write,
            }
        return policy
    except (json.JSONDecodeError, TypeError, ValueError):
        return {}


def classify_action(app_name: str, action: str) -> ActionClass | None:
    """Classify one exact app/action pair, returning None when denied."""
    if not isinstance(app_name, str) or not isinstance(action, str):
        return None
    groups = load_allowed_actions().get(app_name.strip().lower())
    if not groups:
        return None
    normalized = _normalize_action(action)
    if normalized in groups["read"]:
        return "read"
    if normalized in groups["write"]:
        if any(marker in normalized for marker in _SENSITIVE_MARKERS):
            return "sensitive"
        return "write"
    return None
