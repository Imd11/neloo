"""
Message Persistence Module

Provides production-grade message saving with:
- Stable message_id generation (no uuid4 fallback)
- Atomic seq assignment via Supabase RPC
- Strict context validation from RunnableConfig
"""

from typing import Any, Optional
from langchain_core.runnables import RunnableConfig

from ..hidden_prompt_sanitization import sanitize_hidden_prompt_message_data


# =============================================================================
# Message Serialization
# =============================================================================

def serialize_message(message: Any) -> Optional[dict]:
    """
    Serialize any message format to the project's message_data schema.
    
    Target schema:
    {
        "id": str,           # Required
        "type": str,         # "human" | "ai" | "tool"
        "content": str | list,
        "tool_calls": list,  # Optional
        "additional_kwargs": dict,  # Optional
        "response_metadata": dict,  # Optional
        "usage_metadata": dict,     # Optional
    }
    """
    if message is None:
        return None
    
    # Get message id
    if isinstance(message, dict):
        msg_id = message.get("id")
        content = message.get("content", "")
        raw_type = message.get("type", "unknown")
    else:
        msg_id = getattr(message, "id", None)
        content = getattr(message, "content", "")
        # Infer type from class name
        class_name = type(message).__name__
        if "Human" in class_name:
            raw_type = "human"
        elif "AI" in class_name:
            raw_type = "ai"
        elif "Tool" in class_name:
            raw_type = "tool"
        else:
            raw_type = getattr(message, "type", "unknown")
    
    if not msg_id:
        print(f"[MessageSerializer] WARNING: Message has no id, type={raw_type}")
        return None
    
    # Normalize type
    normalized_type = _normalize_type(raw_type)
    
    result = {
        "id": msg_id,
        "type": normalized_type,
        "content": content,
    }
    
    # Optional fields
    optional_fields = [
        "tool_calls",
        "additional_kwargs",
        "response_metadata",
        "usage_metadata",
        "tool_call_id",  # For tool messages
    ]
    
    for field in optional_fields:
        value = message.get(field) if isinstance(message, dict) else getattr(message, field, None)
        if value:
            result[field] = value
    
    return result


def _normalize_type(raw_type: str) -> str:
    """Normalize type field to project convention."""
    t = raw_type.lower()
    if t in ("human", "user"):
        return "human"
    if t in ("ai", "assistant"):
        return "ai"
    if t in ("tool", "function"):
        return "tool"
    if t == "system":
        return "system"
    return raw_type


# =============================================================================
# Stable Message ID Generation
# =============================================================================

def generate_stable_message_id(message: Any, run_id: str, index: int = 0) -> str:
    """
    Generate stable message_id (no uuid4 fallback).
    
    Rules:
    - human: Use the id from message (frontend must provide)
    - ai: f"{run_id}:ai"
    - tool: f"{run_id}:tool:{tool_call_id or index}"
    
    Raises:
        ValueError if human message has no id
    """
    # Try to get existing id
    if isinstance(message, dict):
        existing_id = message.get("id")
        raw_type = message.get("type", "unknown")
    else:
        existing_id = getattr(message, "id", None)
        class_name = type(message).__name__
        if "Human" in class_name:
            raw_type = "human"
        elif "AI" in class_name:
            raw_type = "ai"
        elif "Tool" in class_name:
            raw_type = "tool"
        else:
            raw_type = getattr(message, "type", "unknown")
    
    if existing_id and isinstance(existing_id, str) and existing_id.strip():
        return existing_id
    
    # Generate stable id based on type
    normalized_type = _normalize_type(raw_type)
    
    if normalized_type == "human":
        raise ValueError("Human message missing id - frontend must provide stable id")
    
    if normalized_type == "ai":
        return f"{run_id}:ai"
    
    if normalized_type == "tool":
        tool_call_id = None
        if isinstance(message, dict):
            tool_call_id = message.get("tool_call_id")
        else:
            tool_call_id = getattr(message, "tool_call_id", None)
        
        if tool_call_id:
            return f"{run_id}:tool:{tool_call_id}"
        return f"{run_id}:tool:{index}"
    
    return f"{run_id}:{normalized_type}:{index}"


# =============================================================================
# Context Extraction
# =============================================================================

def extract_context_strict(config: RunnableConfig) -> tuple[str, str]:
    """
    Extract thread_id and run_id from RunnableConfig strictly.
    
    Returns:
        (thread_id, run_id) tuple
        
    Raises:
        ValueError if context is missing or invalid
    """
    if not config:
        raise ValueError("RunnableConfig is required for message persistence")
    
    configurable = config.get("configurable")
    if not isinstance(configurable, dict):
        raise ValueError("RunnableConfig.configurable must be a dict")
    
    thread_id = configurable.get("thread_id")
    if not isinstance(thread_id, str) or not thread_id or thread_id == "default":
        raise ValueError(f"Invalid thread_id in config: {thread_id}")
    
    # Try to get run_id from configurable first, then from config root
    run_id = configurable.get("run_id")
    if not run_id:
        run_id = str(config.get("run_id", ""))
    if not run_id:
        # Generate from thread_id + timestamp as fallback
        import time
        run_id = f"{thread_id}:{int(time.time() * 1000)}"
    
    return thread_id, run_id


# =============================================================================
# Atomic Persistence via Supabase RPC
# =============================================================================

async def persist_message_atomic(
    thread_id: str,
    message_id: str,
    role: str,
    message_data: dict,
) -> Optional[dict]:
    """
    Persist message atomically via Supabase RPC.
    
    Uses the persist_chat_message RPC function which:
    - Uses advisory lock for thread-level serialization
    - Checks if message exists before allocating seq
    - Updates message_data without changing seq on conflict
    
    Args:
        thread_id: The thread ID
        message_id: Stable message ID
        role: "user" | "assistant" | "tool"
        message_data: Complete message object
        
    Returns:
        The persisted record or None if failed
    """
    from ..storage.supabase_db import get_supabase_client, USE_SUPABASE_DB
    
    if not USE_SUPABASE_DB:
        print(f"[Persist] SKIP: Supabase not configured")
        return None
    
    try:
        supabase = await get_supabase_client()
        if not supabase:
            print(f"[Persist] SKIP: No Supabase client")
            return None
        
        result = await supabase.rpc("persist_chat_message", {
            "p_thread_id": thread_id,
            "p_message_id": message_id,
            "p_role": role,
            "p_message_data": message_data,
        }).execute()
        
        if result.data and len(result.data) > 0:
            row = result.data[0]
            print(f"[Persist] OK: thread={thread_id[:8]}... msg={message_id[:8]}... seq={row.get('seq')} role={role}")
            return row
        
        print(f"[Persist] FAIL: No result from RPC (thread={thread_id[:8]}..., msg={message_id[:8]}...)")
        return None
        
    except Exception as e:
        print(f"[Persist] ERROR: {e} (thread={thread_id[:8]}..., msg={message_id[:8]}...)")
        return None


# =============================================================================
# High-Level Persist API
# =============================================================================

async def persist_message(message: Any, config: RunnableConfig, index: int = 0) -> bool:
    """
    Persist a message to the database.
    
    Must be awaited (never use create_task).
    
    Args:
        message: Any message format (LangChain, dict, etc.)
        config: RunnableConfig with thread_id and run_id
        index: Index for tool messages
        
    Returns:
        True if persisted successfully
    """
    try:
        # 1. Extract context
        thread_id, run_id = extract_context_strict(config)
    except ValueError as e:
        print(f"[Persist] SKIPPED: {e}")
        return False
    
    # 2. Generate stable message_id
    try:
        message_id = generate_stable_message_id(message, run_id, index)
    except ValueError as e:
        print(f"[Persist] SKIPPED: {e}")
        return False
    
    # 3. Serialize message
    message_data = serialize_message(message)
    if not message_data:
        print(f"[Persist] SKIPPED: Cannot serialize message")
        return False
    
    # Ensure message_data has the stable id
    message_data["id"] = message_id
    message_data = sanitize_hidden_prompt_message_data(message_data)
    
    # 4. Determine role
    msg_type = message_data.get("type", "unknown")
    if msg_type == "human":
        role = "user"
    elif msg_type == "ai":
        role = "assistant"
    elif msg_type == "tool":
        role = "tool"
    else:
        role = msg_type
    
    # 5. Persist
    result = await persist_message_atomic(thread_id, message_id, role, message_data)
    return result is not None
