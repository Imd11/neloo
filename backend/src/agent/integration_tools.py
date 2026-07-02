"""
Integration Tools - Runtime Dispatcher Pattern

Provides fixed tools for the agent to interact with user's connected apps.
Uses Runtime Dispatcher pattern for security, idempotency, and auditability.

This solves the "Graph Lifecycle Paradox" where Composio tools can't be injected
at graph build time (user_id='default') by deferring execution to runtime.

NO ACTION WHITELIST: Once a user connects an app, the agent has full access
to all operations within Composio's capabilities for that app.
Action ownership validation ensures the requested action belongs to the
connected app (prevents cross-app action leakage).
"""

import os
import json
import hashlib
from typing import Annotated, Optional
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig

from ..runtime_context import user_id_ctx, thread_id_ctx
from ..storage.supabase_db import get_supabase_client



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
    if not config:
        return None
    try:
        configurable = config.get("configurable") or {}
        if isinstance(configurable, dict):
            user_id = configurable.get("user_id")
            if isinstance(user_id, str) and user_id and user_id != "default":
                return user_id
    except Exception:
        return None
    return None


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


def _generate_idempotency_key(
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
    
    if not user_id or user_id in ("default", "anonymous"):
        # Try DB fallback
        if thread_id and thread_id != "default":
            user_id = await _resolve_user_id_for_thread(thread_id)
    
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
        if thread_id and thread_id != "default":
            user_id = await _resolve_user_id_for_thread(thread_id)
    
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

@tool
async def integrations_execute(
    app_name: Annotated[str, "App name, e.g. 'twitter'"],
    action: Annotated[str, "Action to execute, e.g. 'TWITTER_CREATION_OF_A_POST'"],
    params: Annotated[dict, "Action parameters as a dictionary"],
    config: RunnableConfig = None,  # type: ignore[assignment]
) -> dict:
    """
    Execute an action on a connected third-party application.
    
    This tool handles all third-party app integrations with security checks,
    idempotency protection, and audit logging.
    
    NO ACTION WHITELIST: If user has connected the app, the agent can perform
    ANY action available in Composio for that app.
    
    Args:
        app_name: The app to use (e.g., 'twitter', 'notion')
        action: The action to perform (e.g., 'TWITTER_CREATION_OF_A_POST')
        params: Action-specific parameters
    
    Returns:
        A dict with status, result_id, result_url, and message.
    """
    # ==========================================================================
    # Step 1: Resolve user_id and thread_id
    # ==========================================================================
    user_id = _resolve_user_id_from_config(config)
    thread_id = _resolve_thread_id_from_config(config) or thread_id_ctx.get()
    run_id = _resolve_run_id_from_config(config)
    
    if not user_id:
        user_id = user_id_ctx.get()
    
    if not user_id or user_id in ("default", "anonymous"):
        # Try DB fallback
        if thread_id and thread_id != "default":
            user_id = await _resolve_user_id_for_thread(thread_id)
    
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
    # Step 3: Action ownership validation (dynamic - NO whitelist)
    # Ensures the requested action belongs to the connected app
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
                    "message": f"Action {action} is not available. Possible reasons: 1) the action does not belong to {app_name}; 2) Composio does not support this action yet. Known available actions ({len(available_actions)} total): {available_actions[:15]}...",
                    "available_actions": available_actions,
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
    idem_key = _generate_idempotency_key(thread_id, run_id, action, params)
    
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


# =============================================================================
# Export
# =============================================================================

INTEGRATION_TOOLS = [integrations_list_apps, integrations_list_actions, integrations_execute]
