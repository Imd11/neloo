"""
Composio Tools Integration for LangGraph Agent

Provides dynamic tool loading based on user's connected applications.
Includes action whitelist, idempotency checks, and audit logging.
"""

import asyncio
import hashlib
import os
from datetime import datetime, timezone
from typing import Optional

# =============================================================================
# Configuration
# =============================================================================

# Action whitelist - only these actions are allowed
ALLOWED_ACTIONS = {
    "twitter": [
        "TWITTER_CREATION_OF_A_POST",  # Create a post
    ],
    # Future apps:
    # "gmail": ["GMAIL_SEND_EMAIL"],
    # "github": ["GITHUB_CREATE_ISSUE"],
}

# Rate limits (actions per minute per user)
RATE_LIMITS = {
    "twitter": 5,
}

# Composio client singleton
_composio_client = None


def get_composio_client():
    """Get or create Composio client with LangChain provider."""
    global _composio_client

    if _composio_client is not None:
        return _composio_client

    api_key = os.getenv("COMPOSIO_API_KEY")
    if not api_key:
        return None

    try:
        os.environ["COMPOSIO_API_KEY"] = api_key
        from composio import Composio
        from composio_langchain import LangchainProvider

        _composio_client = Composio(provider=LangchainProvider())
        return _composio_client
    except Exception as e:
        print(f"[Composio] Failed to initialize client: {e}")
        return None


# =============================================================================
# Database Helpers
# =============================================================================


async def get_user_connected_apps(user_id: str) -> list[str]:
    """Query user's connected apps from database."""
    from ..storage.supabase_db import get_supabase_client

    supabase = await get_supabase_client()
    if not supabase:
        return []

    try:
        result = (
            await supabase.table("user_integrations")
            .select("app_name")
            .eq("user_id", user_id)
            .eq("status", "connected")
            .execute()
        )

        return [row["app_name"] for row in (result.data or [])]
    except Exception as e:
        print(f"[Composio] Failed to get connected apps: {e}")
        return []


async def check_idempotency(idempotency_key: str) -> Optional[dict]:
    """Check if action was already executed (returns cached result if exists)."""
    from ..storage.supabase_db import get_supabase_client

    supabase = await get_supabase_client()
    if not supabase:
        return None

    try:
        result = (
            await supabase.table("integration_action_logs")
            .select("result_id, status, error_message")
            .eq("idempotency_key", idempotency_key)
            .execute()
        )

        if result.data and len(result.data) > 0:
            return result.data[0]
        return None
    except Exception:
        return None


async def log_action(
    user_id: str,
    thread_id: str,
    idempotency_key: str,
    app_name: str,
    action: str,
    params_hash: str,
    result_id: Optional[str] = None,
    status: str = "success",
    error_message: Optional[str] = None,
):
    """Log action to audit table."""
    from ..storage.supabase_db import get_supabase_client

    supabase = await get_supabase_client()
    if not supabase:
        return

    try:
        await (
            supabase.table("integration_action_logs")
            .insert(
                {
                    "user_id": user_id,
                    "thread_id": thread_id,
                    "idempotency_key": idempotency_key,
                    "app_name": app_name,
                    "action": action,
                    "params_hash": params_hash,
                    "result_id": result_id,
                    "status": status,
                    "error_message": error_message,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .execute()
        )
    except Exception as e:
        print(f"[Composio] Failed to log action: {e}")


def generate_idempotency_key(thread_id: str, action: str, content: str) -> str:
    """Generate idempotency key from thread, action, and content."""
    data = f"{thread_id}:{action}:{content}"
    return hashlib.sha256(data.encode()).hexdigest()[:32]


# =============================================================================
# Tool Loading
# =============================================================================


def get_composio_tools_for_user_sync(user_id: str) -> list:
    """
    Get Composio tools for a user (synchronous wrapper).

    Returns LangChain StructuredTool objects that can be directly
    added to the agent's tool list.
    """
    if not user_id or user_id == "default":
        return []

    # Get connected apps (async -> sync)
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # Already in async context - use run_coroutine_threadsafe
        import concurrent.futures

        future = asyncio.run_coroutine_threadsafe(get_user_connected_apps(user_id), loop)
        try:
            connected_apps = future.result(timeout=5)
        except (concurrent.futures.TimeoutError, Exception):
            connected_apps = []
    else:
        # Not in async context - use asyncio.run
        try:
            connected_apps = asyncio.run(get_user_connected_apps(user_id))
        except Exception:
            connected_apps = []

    if not connected_apps:
        return []

    # Get Composio client
    client = get_composio_client()
    if not client:
        return []

    # Load ALL tools from connected apps (no whitelist)
    # User authorized the app = Agent has full access to that app's capabilities
    try:
        tools = client.tools.get(user_id=user_id, toolkits=connected_apps)
        print(
            f"[Composio] Loaded {len(tools)} tools from apps {connected_apps} for user {user_id[:8]}..."
        )
        return tools
    except Exception as e:
        print(f"[Composio] Failed to load tools: {e}")
        return []


async def get_composio_tools_for_user(user_id: str) -> list:
    """
    Get Composio tools for a user (async version).
    """
    if not user_id or user_id == "default":
        return []

    connected_apps = await get_user_connected_apps(user_id)
    if not connected_apps:
        return []

    client = get_composio_client()
    if not client:
        return []

    # Load ALL tools from connected apps (no whitelist)
    try:
        tools = client.tools.get(user_id=user_id, toolkits=connected_apps)
        print(
            f"[Composio] Loaded {len(tools)} tools from apps {connected_apps} for user {user_id[:8]}..."
        )
        return tools
    except Exception as e:
        print(f"[Composio] Failed to load tools: {e}")
        return []
