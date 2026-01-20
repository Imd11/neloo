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
        return "Error: 无法获取用户身份，请重新登录"
    
    try:
        supabase = await get_supabase_client()
        if not supabase:
            return "Error: 数据库连接失败"
        
        result = await supabase.table("user_integrations")\
            .select("app_name")\
            .eq("user_id", user_id)\
            .eq("status", "connected")\
            .execute()
        
        apps = [r["app_name"] for r in (result.data or [])]
        
        if not apps:
            return "No apps connected. 请在设置中连接应用（如 Twitter）后再使用集成功能。"
        
        return f"Connected apps: {', '.join(apps)}"
        
    except Exception as e:
        print(f"[integrations_list_apps] Error: {e}")
        return f"Error: 查询连接状态失败 - {e}"


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
            "message": "用户未认证，请重新登录",
        }
    
    if not thread_id or thread_id == "default":
        return {
            "status": "error",
            "message": "无法获取 thread_id",
        }
    
    # ==========================================================================
    # Step 2: Connection verification
    # ==========================================================================
    try:
        supabase = await get_supabase_client()
        if not supabase:
            return {"status": "error", "message": "数据库连接失败"}
        
        conn = await supabase.table("user_integrations")\
            .select("composio_connection_id")\
            .eq("user_id", user_id)\
            .eq("app_name", app_name)\
            .eq("status", "connected")\
            .execute()
        
        if not conn.data:
            return {
                "status": "error",
                "message": f"请先在设置中连接 {app_name}",
            }
        
    except Exception as e:
        return {"status": "error", "message": f"连接验证失败: {e}"}
    
    # ==========================================================================
    # Step 3: Action ownership validation (dynamic - NO whitelist)
    # Ensures the requested action belongs to the connected app
    # ==========================================================================
    app_tools = None
    available_actions = []
    
    try:
        from .composio_tools import get_composio_client
        
        client = get_composio_client()
        if not client:
            return {"status": "error", "message": "Composio client 未配置"}
        
        # Fetch all tools for this specific app (using toolkits)
        app_tools = client.tools.get(user_id=user_id, toolkits=[app_name])
        available_actions = [t.name for t in app_tools] if app_tools else []
        
        if action not in available_actions:
            return {
                "status": "error",
                "message": f"操作 {action} 不属于 {app_name}。可用操作 ({len(available_actions)} 个): {available_actions[:10]}{'...' if len(available_actions) > 10 else ''}",
                "available_actions": available_actions,
            }
    except Exception as e:
        print(f"[integrations_execute] Action validation failed: {e}")
        return {
            "status": "error",
            "message": f"无法验证可用操作，请稍后重试: {e}",
        }
    
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
                "message": "此操作已执行过（幂等保护）",
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
    
    try:
        # Find the specific tool by action name from app_tools (already fetched in Step 3)
        tool_instance = None
        for t in app_tools:
            if t.name == action:
                tool_instance = t
                break
        
        if not tool_instance:
            return {"status": "error", "message": f"无法找到工具 {action}"}
        
        # Execute the tool
        result = await tool_instance.ainvoke(params)
        
        # Parse result (structure varies by action)
        if isinstance(result, dict):
            result_id = result.get("id") or result.get("tweet_id") or result.get("data", {}).get("id")
            result_url = result.get("url") or result.get("link")
            # Try to construct URL if not provided
            if result_id and not result_url and app_name == "twitter":
                result_url = f"https://twitter.com/i/status/{result_id}"
        elif isinstance(result, str):
            result_id = result
        
        print(f"[integrations_execute] Success: result_id={result_id}, result_url={result_url}")
        
    except Exception as e:
        print(f"[integrations_execute] Composio execution failed: {e}")
        
        # Log failure
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
            }).execute()
        except Exception:
            pass
        
        return {
            "status": "error",
            "message": f"执行失败: {e}",
        }
    
    # ==========================================================================
    # Step 6: Audit logging
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
            "status": "success",
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
        "message": f"{app_name} 操作成功执行",
    }


# =============================================================================
# Export
# =============================================================================

INTEGRATION_TOOLS = [integrations_list_apps, integrations_execute]
