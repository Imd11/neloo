"""
Integration Tools - Runtime Dispatcher Pattern

Provides fixed tools for the agent to interact with user's connected apps.
Uses Runtime Dispatcher pattern for security, idempotency, and auditability.

This solves the "Graph Lifecycle Paradox" where Composio tools can't be injected
at graph build time (user_id='default') by deferring execution to runtime.

Actions are denied unless the instance operator explicitly classifies the exact
app/action pair as read or write in COMPOSIO_ALLOWED_ACTIONS_JSON.
"""

import os
import json
import hashlib
from datetime import datetime, timezone
from typing import Annotated, Optional
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig

from ..runtime_context import thread_id_ctx, user_id_ctx, user_id_from_config
from ..storage.supabase_db import get_supabase_client
from ..identity import ensure_app_identity
from ..usage_limits import enforce_guest_usage_limit
from .integration_policy import classify_action



# =============================================================================
# Helper Functions
# =============================================================================

def _resolve_thread_id_from_config(config: RunnableConfig | None) -> str | None:
    """Extract thread_id from RunnableConfig.configurable."""
    if not config:
        return None
    try:
        configurable = config.get("configurable") or {}
        if isinstance(configurable, dict):
            thread_id = configurable.get("thread_id")
            if isinstance(thread_id, str) and thread_id:
                return thread_id
    except Exception:
        return None
    return None


def _resolve_user_id_from_config(config: RunnableConfig | None) -> str | None:
    """Extract user_id from RunnableConfig.configurable."""
    return user_id_from_config(config)


def _resolve_run_id_from_config(config: RunnableConfig | None) -> str:
    """Extract run_id from RunnableConfig, or generate one."""
    if config:
        try:
            # LangGraph puts run_id at top level or in configurable
            run_id = config.get("run_id") or config.get("configurable", {}).get("run_id")
            if isinstance(run_id, str) and run_id:
                return run_id
        except Exception:
            pass
    # Fallback: generate a unique run_id
    import uuid
    return str(uuid.uuid4())[:8]


async def _resolve_user_id_for_thread(thread_id: str) -> str | None:
    """
    Resolve authenticated user_id for a LangGraph thread_id via DB.
    Used as fallback when config doesn't contain user_id.
    """
    if not thread_id or thread_id == "default":
        return None
    try:
        from ..storage.supabase_db import USE_SUPABASE_DB, get_thread_by_langgraph_id
        if not USE_SUPABASE_DB:
            return None
        record = await get_thread_by_langgraph_id(thread_id)
        if record and isinstance(record.get("user_id"), str):
            return record["user_id"]
    except Exception as e:
        print(f"[integration_tools] Warning: Failed to resolve user_id for thread: {e}")
    return None


def _generate_legacy_idempotency_key(
    thread_id: str,
    run_id: str,
    action: str,
    params: dict
) -> str:
    """
    Generate idempotency key from thread_id + run_id + action + params_hash.
    
    Including run_id ensures that same content in different runs is allowed,
    while duplicate calls within the same run are deduplicated.
    """
    params_str = json.dumps(params, sort_keys=True, ensure_ascii=False)
    params_hash = hashlib.sha256(params_str.encode()).hexdigest()[:16]
    return f"{thread_id}:{run_id}:{action}:{params_hash}"


# =============================================================================
# Tool Definitions
# =============================================================================

@tool
async def integrations_list_apps(
    config: RunnableConfig = None,  # type: ignore[assignment]
) -> str:
    """
    List the user's connected third-party applications.
    
    Call this tool to discover what integrations are available 
    before attempting to use them with integrations_execute.
    
    Returns:
        A list of connected app names, e.g., "Connected apps: twitter, notion"
        Or "No apps connected" if none are available.
    """
    # Resolve user_id: config -> ContextVar -> DB fallback
    user_id = _resolve_user_id_from_config(config)
    thread_id = _resolve_thread_id_from_config(config) or thread_id_ctx.get()
    
    if not user_id:
        user_id = user_id_ctx.get()
    
    print(f"[integrations_list_apps] user_id={user_id}, thread_id={thread_id}")
    
    if not user_id or user_id in ("default", "anonymous"):
        return "Error: Unable to identify the user. Please sign in again."
    
    try:
        supabase = await get_supabase_client()
        if not supabase:
            return "Error: Database connection failed."
        
        result = await supabase.table("user_integrations")\
            .select("app_name")\
            .eq("user_id", user_id)\
            .eq("status", "connected")\
            .execute()
        
        apps = [r["app_name"] for r in (result.data or [])]
        
        if not apps:
            return "No apps connected. Connect an app such as Twitter in Settings before using integration tools."
        
        return f"Connected apps: {', '.join(apps)}"
        
    except Exception as e:
        print(f"[integrations_list_apps] Error: {e}")
        return f"Error: Failed to query connection status - {e}"


@tool
async def integrations_list_actions(
    app_name: Annotated[str, "App name to list actions for, e.g. 'twitter'"],
    config: RunnableConfig = None,  # type: ignore[assignment]
) -> str:
    """
    List all available actions for a connected app.
    
    Use this to discover what actions can be executed on a specific app.
    For example, to see all Twitter actions: integrations_list_actions(app_name="twitter")
    
    Returns:
        A list of action names that can be used with integrations_execute.
    """
    # Resolve user_id
    user_id = _resolve_user_id_from_config(config)
    thread_id = _resolve_thread_id_from_config(config) or thread_id_ctx.get()
    
    if not user_id:
        user_id = user_id_ctx.get()
    
    if not user_id or user_id in ("default", "anonymous"):
        return "Error: Unable to identify the user."
    
    app_name = app_name.lower()
    
    try:
        from .composio_tools import get_composio_client
        
        client = get_composio_client()
        if not client:
            return "Error: Composio client is not configured."
        
        # Fetch all tools for this app (may be limited to ~20 by Composio)
        app_tools = client.tools.get(user_id=user_id, toolkits=[app_name])
        
        if not app_tools:
            return f"No actions found for {app_name}. Confirm that this app is connected."
        
        actions = [t.name for t in app_tools]
        
        # Log to Railway for debugging
        print(f"[integrations_list_actions] {app_name} has {len(actions)} actions:")
        for i, action in enumerate(actions):
            print(f"  [{i+1}] {action}")
        
        # Return formatted list
        action_list = "\n".join([f"- {a}" for a in actions])
        return f"Available actions for {app_name} ({len(actions)} total):\n{action_list}"
        
    except Exception as e:
        print(f"[integrations_list_actions] Error: {e}")
        return f"Error: Failed to fetch available actions for {app_name} - {e}"

async def _invoke_allowed_action_legacy(
    app_name: Annotated[str, "App name, e.g. 'twitter'"],
    action: Annotated[str, "Action to execute, e.g. 'TWITTER_CREATION_OF_A_POST'"],
    params: Annotated[dict, "Action parameters as a dictionary"],
    classification: str,
    config: RunnableConfig = None,  # type: ignore[assignment]
) -> dict:
    """
    Execute an action on a connected third-party application.
    
    This tool handles all third-party app integrations with security checks,
    idempotency protection, and audit logging.
    
    Args:
        app_name: The app to use (e.g., 'twitter', 'notion')
        action: The action to perform (e.g., 'TWITTER_CREATION_OF_A_POST')
        params: Action-specific parameters
    
    Returns:
        A dict with status, result_id, result_url, and message.
    """
    raise RuntimeError("Legacy integration execution is disabled")

    # ==========================================================================
    # Step 1: Resolve user_id and thread_id
    # ==========================================================================
    user_id = _resolve_user_id_from_config(config)
    thread_id = _resolve_thread_id_from_config(config) or thread_id_ctx.get()
    run_id = _resolve_run_id_from_config(config)
    
    if not user_id:
        user_id = user_id_ctx.get()
    
    print(f"[integrations_execute] user_id={user_id}, thread_id={thread_id}, action={action}")
    
    if not user_id or user_id in ("default", "anonymous"):
        return {
            "status": "error",
            "message": "User is not authenticated. Please sign in again.",
        }
    
    if not thread_id or thread_id == "default":
        return {
            "status": "error",
            "message": "Unable to identify thread_id.",
        }
    
    # ==========================================================================
    # Step 2: Connection verification
    # ==========================================================================
    try:
        supabase = await get_supabase_client()
        if not supabase:
            return {"status": "error", "message": "Database connection failed."}
        
        conn = await supabase.table("user_integrations")\
            .select("composio_connection_id")\
            .eq("user_id", user_id)\
            .eq("app_name", app_name)\
            .eq("status", "connected")\
            .execute()
        
        if not conn.data:
            return {
                "status": "error",
                "message": f"Please connect {app_name} in Settings first.",
            }
        
    except Exception as e:
        return {"status": "error", "message": f"Connection verification failed: {e}"}
    
    # ==========================================================================
    # Step 3: Fetch the exact action after the operator policy has allowed it
    # ==========================================================================
    app_tools = None
    tool_instance = None
    available_actions = []
    
    try:
        from .composio_tools import get_composio_client
        
        client = get_composio_client()
        if not client:
            return {"status": "error", "message": "Composio client is not configured."}
        
        # Method 1: Try direct tool fetch by action name (bypasses 20-action limit)
        # This is the primary method - more reliable than toolkit listing
        try:
            direct_tools = client.tools.get(user_id=user_id, tools=[action])
            if direct_tools and len(direct_tools) > 0:
                tool_instance = direct_tools[0]
                print(f"[integrations_execute] Direct fetch SUCCESS for {action}")
        except Exception as e:
            print(f"[integrations_execute] Direct fetch failed for {action}: {e}")
            tool_instance = None
        
        # If direct fetch failed, check available actions for error message
        if not tool_instance:
            # Fetch toolkit to get available actions list (may be limited to ~20)
            app_tools = client.tools.get(user_id=user_id, toolkits=[app_name])
            available_actions = [t.name for t in app_tools] if app_tools else []
            
            # DEBUG: Print action list
            print(f"[integrations_execute] Composio returned {len(available_actions)} actions for {app_name}:")
            for i, a in enumerate(available_actions):
                print(f"  [{i+1}] {a}")
            
            # Check if action might exist but not in limited list
            if action not in available_actions:
                return {
                    "status": "error",
                    "message": f"The configured {app_name} action is unavailable.",
                }
            else:
                # Action is in list, find it
                for t in app_tools:
                    if t.name == action:
                        tool_instance = t
                        break
    except Exception as e:
        print(f"[integrations_execute] Action validation failed: {e}")
        return {
            "status": "error",
            "message": f"Unable to validate available actions. Please try again later: {e}",
        }
    
    if not tool_instance:
        return {"status": "error", "message": f"Unable to fetch tool {action}"}
    
    # ==========================================================================
    # Step 4: Idempotency check
    # ==========================================================================
    idem_key = _generate_legacy_idempotency_key(thread_id, run_id, action, params)
    
    try:
        existing = await supabase.table("integration_action_logs")\
            .select("result_id, status, error_message")\
            .eq("user_id", user_id)\
            .eq("idempotency_key", idem_key)\
            .execute()
        
        if existing.data:
            cached = existing.data[0]
            print(f"[integrations_execute] Idempotency hit: {idem_key}")
            return {
                "status": "cached",
                "message": "This action has already been executed and was skipped by idempotency protection.",
                "result_id": cached.get("result_id"),
                "cached": True,
            }
    except Exception as e:
        print(f"[integrations_execute] Idempotency check warning: {e}")
        # Continue anyway - better to risk duplicate than fail
    
    # ==========================================================================
    # Step 5: Execute via Composio SDK (reuse app_tools from Step 3)
    # ==========================================================================
    result_id = None
    result_url = None
    raw_result = None  # Store full Composio response for debugging
    
    try:
        # tool_instance already obtained in Step 3
        # Execute the tool
        result = await tool_instance.ainvoke(params)
        
        # Store raw result for audit logging (convert to serializable format)
        if result is not None:
            if isinstance(result, dict):
                raw_result = result
            elif isinstance(result, str):
                raw_result = {"raw_string": result}
            else:
                raw_result = {"raw_value": str(result)}
        
        # Parse result - extract IDs based on known Composio response structures
        # Twitter-specific: Composio may return nested structures
        if isinstance(result, dict):
            # Try multiple known paths for tweet_id
            result_id = (
                result.get("id") or 
                result.get("tweet_id") or 
                result.get("data", {}).get("id") or
                result.get("data", {}).get("tweet_id") or
                result.get("result", {}).get("id") or
                result.get("result", {}).get("data", {}).get("id")
            )
            
            # Try to get URL from response
            result_url = (
                result.get("url") or 
                result.get("link") or
                result.get("data", {}).get("url")
            )
            
            # Construct Twitter URL if we have tweet_id but no URL
            if result_id and not result_url and app_name == "twitter":
                result_url = f"https://x.com/i/status/{result_id}"
                
        elif isinstance(result, str):
            # Check if string looks like an error message
            error_keywords = ["error", "failed", "invalid", "unauthorized", "forbidden"]
            if any(kw in result.lower() for kw in error_keywords):
                # This is an error, not a result ID
                print(f"[integrations_execute] Result string appears to be an error: {result[:100]}")
                raw_result = {"error_string": result}
            else:
                # Treat as potential result ID
                result_id = result
        
        # Determine status based on what we extracted
        if result_id:
            execution_status = "success"
        else:
            execution_status = "success_no_id"  # Executed but couldn't extract ID
            
        print(f"[integrations_execute] Success: result_id={result_id}, result_url={result_url}, status={execution_status}")
        
    except Exception as e:
        print(f"[integrations_execute] Composio execution failed: {e}")
        
        # Log failure with raw error
        try:
            await supabase.table("integration_action_logs").insert({
                "user_id": user_id,
                "thread_id": thread_id,
                "idempotency_key": idem_key,
                "app_name": app_name,
                "action": action,
                "params_hash": hashlib.sha256(json.dumps(params, sort_keys=True).encode()).hexdigest()[:32],
                "status": "failed",
                "error_message": str(e),
                "raw_result": {"exception": str(e), "exception_type": type(e).__name__},
            }).execute()
        except Exception as log_err:
            print(f"[integrations_execute] Warning: Failed to log failure: {log_err}")
        
        return {
            "status": "error",
            "message": f"Execution failed: {e}",
        }
    
    # ==========================================================================
    # Step 6: Audit logging (with raw_result)
    # ==========================================================================
    try:
        await supabase.table("integration_action_logs").insert({
            "user_id": user_id,
            "thread_id": thread_id,
            "idempotency_key": idem_key,
            "app_name": app_name,
            "action": action,
            "params_hash": hashlib.sha256(json.dumps(params, sort_keys=True).encode()).hexdigest()[:32],
            "result_id": result_id,
            "result_url": result_url,
            "raw_result": raw_result,
            "status": execution_status,
        }).execute()
    except Exception as e:
        print(f"[integrations_execute] Warning: Failed to log action: {e}")
    
    # ==========================================================================
    # Return structured result
    # ==========================================================================
    return {
        "status": "success",
        "action": action,
        "app_name": app_name,
        "result_id": result_id,
        "result_url": result_url,
        "message": f"{app_name} action executed successfully" + (f" - View: {result_url}" if result_url else ""),
    }


def _generate_idempotency_key(
    user_id: str,
    thread_id: str,
    run_id: str,
    app_name: str,
    action: str,
    params: dict,
) -> str:
    canonical = json.dumps(
        {
            "user_id": user_id,
            "thread_id": thread_id,
            "run_id": run_id,
            "app": app_name.strip().lower(),
            "action": action.strip().upper(),
            "params": params,
        },
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


async def _verify_connected_app(supabase, user_id: str, app_name: str) -> bool:
    result = await (
        supabase.table("user_integrations")
        .select("composio_connection_id")
        .eq("user_id", user_id)
        .eq("app_name", app_name)
        .eq("status", "connected")
        .execute()
    )
    return bool(result.data)


async def _reserve_integration_action(supabase, payload: dict) -> dict:
    result = await supabase.rpc("reserve_integration_action", payload).execute()
    if not result.data:
        raise RuntimeError("Idempotency reservation returned no state")
    return result.data[0]


async def _update_integration_action(
    supabase,
    *,
    user_id: str,
    idempotency_key: str,
    status: str,
    **fields,
) -> None:
    payload = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        **fields,
    }
    await (
        supabase.table("integration_action_logs")
        .update(payload)
        .eq("user_id", user_id)
        .eq("idempotency_key", idempotency_key)
        .eq("status", "pending")
        .execute()
    )


def _get_composio_tool(user_id: str, action: str):
    from .composio_tools import get_composio_client

    client = get_composio_client()
    if not client:
        return None
    tools = client.tools.get(user_id=user_id, tools=[action])
    return tools[0] if tools else None


def _result_fields(result) -> tuple[str | None, str | None, dict]:
    if isinstance(result, dict):
        result_id = result.get("id") or result.get("result_id")
        nested = result.get("data")
        if not result_id and isinstance(nested, dict):
            result_id = nested.get("id")
        result_url = result.get("url") or result.get("link")
        if not result_url and isinstance(nested, dict):
            result_url = nested.get("url")
        return str(result_id) if result_id else None, str(result_url) if result_url else None, result
    if isinstance(result, str):
        return None, None, {"raw_string": result}
    return None, None, {"raw_value": str(result)}


async def _invoke_allowed_action(
    app_name: str,
    action: str,
    params: dict,
    classification: str,
    config: RunnableConfig = None,  # type: ignore[assignment]
) -> dict:
    user_id = _resolve_user_id_from_config(config) or user_id_ctx.get()
    thread_id = _resolve_thread_id_from_config(config) or thread_id_ctx.get()
    run_id = _resolve_run_id_from_config(config)
    if not user_id or user_id in {"default", "anonymous"}:
        return {"status": "error", "message": "Authenticated identity is required."}
    if not thread_id or thread_id == "default":
        return {"status": "error", "message": "A valid thread is required."}

    try:
        await ensure_app_identity(user_id, "guest")
        supabase = await get_supabase_client()
        if supabase is None:
            raise RuntimeError("Database connection is unavailable")
        if not await _verify_connected_app(supabase, user_id, app_name):
            return {"status": "error", "message": f"Connect {app_name} in Settings first."}
    except Exception:
        return {"status": "error", "message": "Unable to verify the connected application."}

    idempotency_key = None
    if classification in {"write", "sensitive"}:
        try:
            await enforce_guest_usage_limit("integration", user_id)
        except Exception:
            return {"status": "error", "message": "Integration usage limit exceeded."}
        idempotency_key = _generate_idempotency_key(
            user_id, thread_id, run_id, app_name, action, params
        )
        try:
            reservation = await _reserve_integration_action(
                supabase,
                {
                    "p_user_id": user_id,
                    "p_thread_id": thread_id,
                    "p_run_id": run_id,
                    "p_app_name": app_name,
                    "p_action": action,
                    "p_params_hash": hashlib.sha256(
                        json.dumps(params, sort_keys=True, ensure_ascii=False).encode("utf-8")
                    ).hexdigest(),
                    "p_idempotency_key": idempotency_key,
                },
            )
        except Exception:
            return {"status": "error", "message": "Action reservation failed; nothing was executed."}

        if not reservation.get("created"):
            status = reservation.get("status")
            if status == "success":
                return {
                    "status": "cached",
                    "result_id": reservation.get("result_id"),
                    "result": reservation.get("raw_result"),
                    "cached": True,
                }
            if status == "pending":
                return {
                    "status": "in_progress",
                    "message": "This action is pending and requires reconciliation before any retry.",
                }
            return {
                "status": "failed",
                "message": "The previous action failed. Create a new explicit action to retry.",
            }

    provider_tool = _get_composio_tool(user_id, action)
    if provider_tool is None:
        if idempotency_key:
            await _update_integration_action(
                supabase,
                user_id=user_id,
                idempotency_key=idempotency_key,
                status="failed",
                error_message="Configured provider action is unavailable",
            )
        return {"status": "error", "message": "The configured provider action is unavailable."}

    try:
        result = await provider_tool.ainvoke(params)
    except Exception as exc:
        if idempotency_key:
            await _update_integration_action(
                supabase,
                user_id=user_id,
                idempotency_key=idempotency_key,
                status="failed",
                error_message=str(exc),
            )
        return {"status": "error", "message": "The connected application action failed."}

    result_id, result_url, raw_result = _result_fields(result)
    if idempotency_key:
        try:
            await _update_integration_action(
                supabase,
                user_id=user_id,
                idempotency_key=idempotency_key,
                status="success",
                result_id=result_id,
                result_url=result_url,
                raw_result=raw_result,
                error_message=None,
            )
        except Exception:
            return {
                "status": "error",
                "message": "The action completed, but its audit result could not be saved. Do not retry automatically.",
            }
    return {
        "status": "success",
        "action": action,
        "app_name": app_name,
        "result_id": result_id,
        "result_url": result_url,
        "result": raw_result,
    }


def _policy_denied(message: str) -> dict:
    return {"status": "denied", "message": message}


@tool
async def integrations_query(
    app_name: Annotated[str, "Connected app name, e.g. 'gmail'"],
    action: Annotated[str, "Operator-allowed read action"],
    params: Annotated[dict, "Action parameters as a dictionary"],
    config: RunnableConfig = None,  # type: ignore[assignment]
) -> dict:
    """Run an operator-allowed, read-only action in a connected application."""
    classification = classify_action(app_name, action)
    if classification != "read":
        return _policy_denied("This action is not allowed as a read operation.")
    return await _invoke_allowed_action(
        app_name.strip().lower(),
        action.strip().upper(),
        params,
        classification,
        config,
    )


@tool
async def integrations_execute(
    app_name: Annotated[str, "Connected app name, e.g. 'gmail'"],
    action: Annotated[str, "Operator-allowed write action"],
    params: Annotated[dict, "Action parameters as a dictionary"],
    config: RunnableConfig = None,  # type: ignore[assignment]
) -> dict:
    """Execute an approved write action in a connected application."""
    classification = classify_action(app_name, action)
    if classification not in {"write", "sensitive"}:
        return _policy_denied("This action is not allowed as a write operation.")
    return await _invoke_allowed_action(
        app_name.strip().lower(),
        action.strip().upper(),
        params,
        classification,
        config,
    )


# =============================================================================
# Export
# =============================================================================

INTEGRATION_TOOLS = [
    integrations_list_apps,
    integrations_list_actions,
    integrations_query,
    integrations_execute,
]
