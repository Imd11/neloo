"""
FastAPI Application for File Upload

This module provides custom HTTP routes for the LangGraph server,
specifically for handling data file uploads.

Storage modes:
- Supabase Storage (production): When SUPABASE_URL and SUPABASE_SERVICE_KEY are set
- Local Storage (development): Falls back to local filesystem storage

Routes:
- POST /files/upload - Upload a data file
- GET /files/list - List user's uploaded files
- DELETE /files/{filename} - Delete a file
- GET /files/download-url/{filename} - Get signed download URL
"""

import os
import json
import uuid
import tempfile
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Query, Depends, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, RedirectResponse
from starlette.responses import StreamingResponse
from pydantic import BaseModel

# Import authentication
from .auth import (
    extract_token_from_header,
    get_current_user,
    get_jwt_secret,
    get_optional_user,
    verify_jwt_token,
    get_user_id as auth_get_user_id,
)
from ..runtime_context import user_id_ctx, thread_id_ctx

# Import image storage
from ..storage import get_image, get_image_storage

# Import generated file storage
from ..storage.file_storage import (
    get_file_storage,
    get_generated_file,
    list_generated_files,
    get_mime_type,
)

# Import database operations for file listing
from ..storage.supabase_db import (
    get_files_by_type,
    get_user_files,
    get_thread_files,
    get_file_by_id,
    count_file_thread_links,
    delete_file_record,
    delete_thread_file_link,
    delete_thread_record,
    create_thread,
    get_user_threads,
    get_thread_by_langgraph_id,
    update_thread_title,
    USE_SUPABASE_DB,
    FileType,
    create_thread_message,
    get_thread_messages,
    # Upload session management
    create_upload_session,
    get_upload_session,
    update_upload_session_status,
    commit_upload_session,
    get_user_pending_uploads,
    cleanup_expired_uploads,
)

# =============================================================================
# Configuration
# =============================================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
BUCKET_NAME = "data-analyst-files"

# Check if we're using local storage mode
USE_LOCAL_STORAGE = not (SUPABASE_URL and SUPABASE_SERVICE_KEY)

# Async Supabase client singleton
_supabase_client = None

# Local storage directory - use the sandbox data directory for simplicity
# This way uploaded files are directly available to the sandbox executor
LOCAL_STORAGE_DIR = Path(tempfile.gettempdir()) / "data-analyst-sandbox" / "data"
# Note: Directory creation moved to async context to avoid blocking

# Supported file extensions
ALLOWED_EXTENSIONS = {
    # Data files
    ".csv", ".xlsx", ".xls", ".dta", ".sav", ".parquet",
    # Image files (for multimodal)
    ".png", ".jpg", ".jpeg", ".gif", ".webp",
}

# Maximum file size (100 MB)
MAX_FILE_SIZE = 100 * 1024 * 1024

# Upload session TTL (1 hour)
UPLOAD_SESSION_TTL_SECONDS = 3600

# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="Data Analyst File API",
    description="File upload API for the Data Analyst Agent",
    version="1.0.0",
)

# =============================================================================
# Request Context Middleware
# =============================================================================
#
# LangGraph endpoints are served inside this FastAPI app. Tool calls (e.g. execute_python)
# need the authenticated user_id + current thread_id so file syncing targets the correct
# Supabase Storage path and generated artifacts can be associated with the right thread.
#
# IMPORTANT: For streaming responses, ContextVar values must remain set for the entire
# stream iteration; otherwise tool calls during streaming will fall back to defaults.
#


def _extract_thread_id_from_path(path: str) -> str | None:
    parts = [p for p in path.split("/") if p]
    for i, part in enumerate(parts):
        if part == "threads" and i + 1 < len(parts):
            return parts[i + 1]
    return None


@app.middleware("http")
async def _set_runtime_context(request: Request, call_next):
    user_id = "default"
    thread_id = _extract_thread_id_from_path(request.url.path) or "default"

    authorization = request.headers.get("authorization")
    token = extract_token_from_header(authorization)
    if token:
        try:
            payload = verify_jwt_token(token)
            user_id = payload.get("sub", "default")
        except HTTPException:
            pass
    else:
        if not get_jwt_secret():
            user_id = request.headers.get("x-user-id") or "default"
        else:
            user_id = "anonymous"

    user_token = user_id_ctx.set(user_id)
    thread_token = thread_id_ctx.set(thread_id)

    response = await call_next(request)

    if isinstance(response, StreamingResponse):
        original_iterator = response.body_iterator

        async def _wrap_iterator():
            try:
                async for chunk in original_iterator:
                    yield chunk
            finally:
                user_id_ctx.reset(user_token)
                thread_id_ctx.reset(thread_token)

        response.body_iterator = _wrap_iterator()
        return response

    user_id_ctx.reset(user_token)
    thread_id_ctx.reset(thread_token)
    return response


# CORS (webapp-only mode)
def _parse_cors_allow_origins(value: str | None) -> list[str]:
    if not value:
        return ["*"]
    parts = [p.strip() for p in value.split(",")]
    return [p for p in parts if p]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_allow_origins(os.environ.get("CORS_ALLOW_ORIGINS")),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# In-memory thread history (compat; not durable)
_THREAD_HISTORY: dict[str, list[dict]] = {}


def _append_history(thread_id: str, message: dict) -> None:
    if "id" not in message:
        message = {**message, "id": str(uuid.uuid4())}
    _THREAD_HISTORY.setdefault(thread_id, []).append(message)


def _get_history(thread_id: str) -> list[dict]:
    return _THREAD_HISTORY.get(thread_id, [])




# =============================================================================
# Mock LangGraph Assistants API (for LangGraph SDK compatibility)
# =============================================================================
# The frontend uses @langchain/langgraph-sdk which calls /assistants/* endpoints.
# These are normally only available in the official langgraph-api Docker image.
# We provide mock implementations to satisfy the SDK without requiring a license.

class AssistantInfo(BaseModel):
    """LangGraph Assistant response model."""
    assistant_id: str
    graph_id: str
    created_at: str
    updated_at: str
    config: dict = {}
    metadata: dict = {}
    version: int = 1
    name: str = "Assistant"

class AssistantSearchRequest(BaseModel):
    """LangGraph Assistant search request model."""
    graph_id: str | None = None
    limit: int = 100
    offset: int = 0
    metadata: dict | None = None

@app.post("/assistants/search", response_model=list[AssistantInfo])
async def search_assistants(request: Request):
    """
    Mock LangGraph assistants search endpoint.
    
    Returns a system-created assistant matching the requested graph_id.
    This satisfies the LangGraph SDK's client.assistants.search() call.
    """
    try:
        body = await request.json()
    except:
        body = {}
    
    graph_id = body.get("graph_id") or body.get("graphId") or "data_analyst"
    limit = body.get("limit", 100)
    
    now = datetime.utcnow().isoformat() + "Z"
    
    # Return a mock assistant that matches the requested graph
    return [{
        "assistant_id": graph_id,
        "graph_id": graph_id,
        "created_at": now,
        "updated_at": now,
        "config": {},
        "metadata": {"created_by": "system"},
        "version": 1,
        "name": f"Assistant ({graph_id})",
    }]

@app.get("/assistants/{assistant_id}", response_model=AssistantInfo)
async def get_assistant(assistant_id: str):
    """
    Mock LangGraph get assistant endpoint.
    
    Returns a mock assistant with the requested ID.
    This satisfies the LangGraph SDK's client.assistants.get() call.
    """
    now = datetime.utcnow().isoformat() + "Z"
    
    return {
        "assistant_id": assistant_id,
        "graph_id": assistant_id,
        "created_at": now,
        "updated_at": now,
        "config": {},
        "metadata": {"created_by": "system"},
        "version": 1,
        "name": f"Assistant ({assistant_id})",
    }


# =============================================================================
# LangGraph SDK Compatibility: /threads/* endpoints (webapp-only mode)
# =============================================================================


class ThreadCreateResponse(BaseModel):
    thread_id: str
    created_at: str
    metadata: dict = {}


@app.post("/threads", response_model=ThreadCreateResponse)
async def create_thread_for_sdk(request: Request, user: dict = Depends(get_optional_user)):
    """
    Minimal LangGraph SDK compatible thread creation.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    thread_id = body.get("thread_id") or body.get("threadId") or str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"

    # Ensure a DB thread record exists if we have auth and Supabase DB is configured.
    if user and USE_SUPABASE_DB:
        try:
            await create_thread(
                user_id=auth_get_user_id(user),
                langgraph_thread_id=thread_id,
                title="New Task",
                mode="default",
            )
        except Exception:
            pass

    return {"thread_id": thread_id, "created_at": now, "metadata": body.get("metadata") or {}}


@app.get("/threads/{thread_id}", response_model=ThreadCreateResponse)
async def get_thread_for_sdk(thread_id: str, user: dict = Depends(get_optional_user)):
    """
    Minimal thread fetch endpoint for SDK compatibility.
    """
    return {"thread_id": thread_id, "created_at": datetime.utcnow().isoformat() + "Z", "metadata": {}}


@app.post("/threads/{thread_id}", response_model=ThreadCreateResponse)
async def post_thread_for_sdk(thread_id: str, user: dict = Depends(get_optional_user)):
    """
    Some SDK codepaths may POST to /threads/{id}. Treat it as an idempotent fetch.
    """
    return {"thread_id": thread_id, "created_at": datetime.utcnow().isoformat() + "Z", "metadata": {}}


@app.get("/threads/{thread_id}/history")
async def get_thread_history_for_sdk(thread_id: str, user: dict = Depends(get_optional_user)):
    """
    History endpoint for SDK to rehydrate messages.
    
    Returns ThreadState[] format as expected by @langchain/langgraph-sdk.
    The SDK's fetchHistory() calls client.threads.getHistory() which expects:
    - values: { messages: [...] }
    - checkpoint: { thread_id, checkpoint_ns, checkpoint_id }
    - next: []
    - metadata: {}
    - tasks: []
    
    PRIMARY: Read from graph checkpointer (PostgreSQL) for complete state
    FALLBACK: Read from thread_messages table if checkpointer fails
    """
    from ..agent.graph import _MODEL_GRAPHS, graph as default_graph
    
    messages = []
    checkpoint_id = None
    
    # Try to read from checkpointer first (single source of truth)
    try:
        # Use default graph which should have PostgreSQL checkpointer
        config = {"configurable": {"thread_id": thread_id}}
        state = await default_graph.aget_state(config)
        
        if state and hasattr(state, 'values') and state.values:
            state_messages = state.values.get("messages", [])
            
            # Serialize messages for SDK
            for msg in state_messages:
                serialized = serialize_message_chunk_for_sdk(msg)
                if not serialized.get("id"):
                    serialized["id"] = getattr(msg, 'id', None) or str(uuid.uuid4())
                messages.append(serialized)
            
            # Get checkpoint info if available
            if hasattr(state, 'config') and state.config:
                configurable = state.config.get('configurable', {})
                checkpoint_id = configurable.get('checkpoint_id')
            
            print(f"[HISTORY] Read {len(messages)} messages from checkpointer for thread {thread_id}")
    except Exception as e:
        print(f"[HISTORY] Checkpointer read failed: {e}, falling back to DB")
        messages = []
    
    # Fallback to thread_messages table if checkpointer returned nothing
    if not messages:
        if user and USE_SUPABASE_DB:
            user_id = auth_get_user_id(user)
            rows = await get_thread_messages(user_id=user_id, langgraph_thread_id=thread_id, limit=500)
            # Build messages array with SDK-compatible format
            for r in rows:
                if r.get("message_data"):
                    msg = r["message_data"]
                    if "id" not in msg or not msg["id"]:
                        msg["id"] = r.get("id")
                    messages.append(msg)
                else:
                    messages.append({
                        "id": r.get("id"),
                        "type": r.get("role"),
                        "content": r.get("content")
                    })
            print(f"[HISTORY] Read {len(messages)} messages from DB for thread {thread_id}")
        else:
            messages = _get_history(thread_id)
    
    # Return ThreadState[] format expected by SDK
    if not messages:
        return []
    
    return [{
        "values": {
            "messages": messages
        },
        "next": [],
        "checkpoint": {
            "thread_id": thread_id,
            "checkpoint_ns": "",
            "checkpoint_id": checkpoint_id
        },
        "metadata": {},
        "created_at": None,
        "tasks": []
    }]


@app.post("/threads/{thread_id}/history")
async def post_thread_history_for_sdk(thread_id: str, user: dict = Depends(get_optional_user)):
    """
    Backwards/alternate SDK compatibility: some clients POST to /history.
    """
    return await get_thread_history_for_sdk(thread_id=thread_id, user=user)


def serialize_message_chunk_for_sdk(msg, content_block_index: int = 0) -> dict:
    """
    Serialize a LangChain message chunk to SDK-compatible format.
    
    The SDK's coerceMessageLikeToMessage() requires type='ai', not 'AIMessageChunk'.
    This function converts the message to the correct format.
    
    IMPORTANT: content is output as an ARRAY of typed blocks to match official runtime:
    [
        {"type": "thinking", "thinking": "...", "index": 0},
        {"type": "text", "text": "...", "index": 1},
        {"type": "tool_use", "id": "...", "name": "...", "input": {...}, "index": 2}
    ]
    """
    # Map LangChain class names to SDK-expected types
    type_mapping = {
        "AIMessageChunk": "ai",
        "AIMessage": "ai",
        "HumanMessage": "human",
        "HumanMessageChunk": "human",
        "ToolMessage": "tool",
        "SystemMessage": "system",
    }
    
    msg_type = type(msg).__name__
    sdk_type = type_mapping.get(msg_type, getattr(msg, 'type', 'ai') if hasattr(msg, 'type') else 'ai')
    # Handle case where msg.type is also 'AIMessageChunk' etc
    if sdk_type in type_mapping:
        sdk_type = type_mapping[sdk_type]
    
    # Build content as array of typed blocks
    content_blocks = []
    current_index = content_block_index
    
    # Check for thinking/reasoning content first
    # DeepSeek may put reasoning in different locations:
    reasoning_content = None
    
    # 1. Check additional_kwargs.reasoning_content (most common)
    if hasattr(msg, 'additional_kwargs') and msg.additional_kwargs:
        reasoning_content = msg.additional_kwargs.get('reasoning_content')
    
    # 2. Check direct attribute
    if not reasoning_content and hasattr(msg, 'reasoning_content'):
        reasoning_content = getattr(msg, 'reasoning_content', None)
    
    # 3. Check response_metadata
    if not reasoning_content and hasattr(msg, 'response_metadata') and msg.response_metadata:
        reasoning_content = msg.response_metadata.get('reasoning_content')
    
    if reasoning_content:
        content_blocks.append({
            "type": "thinking",
            "thinking": reasoning_content,
            "index": 0  # thinking is always index 0
        })
        current_index = 1  # next block starts at 1
    
    # Check for regular text content
    raw_content = msg.content if hasattr(msg, 'content') else ""
    if raw_content and isinstance(raw_content, str) and raw_content.strip():
        content_blocks.append({
            "type": "text",
            "text": raw_content,
            "index": current_index
        })
        current_index += 1
    elif raw_content and isinstance(raw_content, list):
        # Content might already be a list of blocks (some providers do this)
        for block in raw_content:
            if isinstance(block, dict):
                if "type" not in block:
                    block["type"] = "text"
                if "index" not in block:
                    block["index"] = current_index
                    current_index += 1
                content_blocks.append(block)
            elif isinstance(block, str):
                content_blocks.append({
                    "type": "text",
                    "text": block,
                    "index": current_index
                })
                current_index += 1
    
    # Add tool_use blocks if present
    if hasattr(msg, 'tool_calls') and msg.tool_calls:
        for tc in msg.tool_calls:
            tc_id = tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None)
            tc_name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
            tc_args = tc.get("args") if isinstance(tc, dict) else getattr(tc, "args", {})
            
            # Only include tool calls with valid id AND name
            if tc_id and tc_name:
                content_blocks.append({
                    "type": "tool_use",
                    "id": tc_id,
                    "name": tc_name,
                    "input": tc_args or {},
                    "index": current_index
                })
                current_index += 1
    
    result = {
        "type": sdk_type,
        "id": getattr(msg, 'id', None),
        "content": content_blocks,  # Array of typed blocks
        "additional_kwargs": {},  # Keep for compatibility but empty (data moved to content blocks)
        "response_metadata": {},
    }
    
    # Add original additional_kwargs (excluding reasoning_content which moved to content block)
    if hasattr(msg, 'additional_kwargs') and msg.additional_kwargs:
        result["additional_kwargs"] = {k: v for k, v in msg.additional_kwargs.items() if k != 'reasoning_content'}
    
    # Add tool_call_id for ToolMessage
    if hasattr(msg, 'tool_call_id') and msg.tool_call_id:
        result["tool_call_id"] = msg.tool_call_id
    
    return result


@app.post("/threads/{thread_id}/runs/stream")
async def run_thread_stream_for_sdk(
    thread_id: str,
    request: Request,
    user: dict = Depends(get_optional_user),
):
    """
    True streaming endpoint for @langchain/langgraph-sdk/react useStream().
    Streams Server-Sent Events (SSE) with token-by-token output.
    
    Uses stream_mode="messages" for LLM token-level streaming when available,
    falls back to stream_mode="values" for non-streaming scenarios.
    """
    from ..agent.graph import _MODEL_GRAPHS, graph as default_graph
    from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, ToolMessage

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    assistant_id = (
        payload.get("assistant_id")
        or payload.get("assistantId")
        or payload.get("graph_id")
        or payload.get("graphId")
    )
    active_graph = _MODEL_GRAPHS.get(assistant_id) if assistant_id else None
    if active_graph is None:
        active_graph = default_graph

    user_input = payload.get("input") or payload.get("message") or {}
    if isinstance(user_input, str):
        user_text = user_input
    elif isinstance(user_input, dict):
        messages = user_input.get("messages")
        if isinstance(messages, list) and messages:
            last = messages[-1]
            if isinstance(last, dict):
                user_text = last.get("content") or ""
            else:
                user_text = str(last)
        else:
            user_text = user_input.get("text") or ""
    else:
        user_text = ""

    run_id = str(uuid.uuid4())
    # Message IDs are now generated per-step in get_message_id_for_step()

    async def event_generator():
        yield f"event: metadata\ndata: {json.dumps({'run_id': run_id, 'thread_id': thread_id}, ensure_ascii=False)}\n\n"

        if user_text:
            _append_history(thread_id, {"type": "human", "content": user_text})
            if user and USE_SUPABASE_DB:
                await create_thread_message(
                    user_id=auth_get_user_id(user),
                    langgraph_thread_id=thread_id,
                    role="human",
                    content=user_text,
                )

        config = {"configurable": {"thread_id": thread_id}}
        accumulated_content = ""  # For backwards compat (text only)
        accumulated_thinking = ""  # Accumulate thinking/reasoning content
        # Accumulate tool_call args across chunks (streaming sends args piece by piece)
        accumulated_tool_calls = {}  # {tool_call_id: {"id", "name", "args"}}
        
        # TIME-ORDERED content blocks list for DB save
        # Each item is {"type": "thinking"|"text"|"tool_use", "content/text/name": ...}
        # This preserves the exact interleaved order: thinking → tool → thinking → tool
        time_ordered_blocks = []  # List of content blocks in arrival order
        current_thinking_block = None  # Track current thinking block being accumulated
        current_text_block = None  # Track current text block being accumulated
        seen_tool_ids = set()  # Track which tool_calls we've added to blocks
        
        # Generate unique message ID per (langgraph_step, langgraph_node) combination
        # This allows different steps to coexist in the message history instead of overwriting
        step_message_ids = {}  # {(step, node): message_id}
        
        def get_message_id_for_step(metadata: dict) -> str:
            """Get or create a stable message ID for a given langgraph step."""
            step = metadata.get("langgraph_step", 0)
            node = metadata.get("langgraph_node", "unknown")
            key = (step, node)
            if key not in step_message_ids:
                step_message_ids[key] = str(uuid.uuid4())
            return step_message_ids[key]
        
        try:
            # Try streaming with "messages" mode for token-level output
            # This mode yields (AIMessageChunk, metadata) tuples for each LLM token
            async for chunk in active_graph.astream(
                {"messages": [HumanMessage(content=user_text)]},
                config=config,
                stream_mode="messages",
            ):
                # stream_mode="messages" yields tuples of (message_chunk, metadata)
                if isinstance(chunk, tuple) and len(chunk) >= 2:
                    message_chunk = chunk[0]
                    metadata = chunk[1]  # Preserve metadata for SDK
                    
                    # Accumulate tool_calls args across chunks
                    # LangChain may send args as: dict, JSON string fragment, or partial dict
                    # Also check tool_call_chunks which is another format LangChain uses
                    
                    # DEBUG: Log tool_call structure for first occurrence
                    if hasattr(message_chunk, 'tool_calls') and message_chunk.tool_calls and not hasattr(event_generator, '_tool_debug_logged'):
                        event_generator._tool_debug_logged = True
                        print(f"[DEBUG] tool_calls: {message_chunk.tool_calls}", flush=True)
                        print(f"[DEBUG] tool_calls type: {type(message_chunk.tool_calls)}", flush=True)
                        if message_chunk.tool_calls:
                            first_tc = message_chunk.tool_calls[0]
                            print(f"[DEBUG] first tool_call type: {type(first_tc)}, value: {first_tc}", flush=True)
                    
                    if hasattr(message_chunk, 'tool_call_chunks') and message_chunk.tool_call_chunks and not hasattr(event_generator, '_chunk_debug_logged'):
                        event_generator._chunk_debug_logged = True
                        print(f"[DEBUG] tool_call_chunks: {message_chunk.tool_call_chunks}", flush=True)
                    
                    # IMPORTANT: tool_call_chunks contains the actual args as string fragments
                    # tool_calls.args is often empty {} while the real args come via tool_call_chunks
                    if hasattr(message_chunk, 'tool_call_chunks') and message_chunk.tool_call_chunks:
                        for tcc in message_chunk.tool_call_chunks:
                            tcc_id = tcc.get("id") if isinstance(tcc, dict) else getattr(tcc, "id", None)
                            tcc_name = tcc.get("name") if isinstance(tcc, dict) else getattr(tcc, "name", None)
                            tcc_args = tcc.get("args") if isinstance(tcc, dict) else getattr(tcc, "args", None)
                            
                            if tcc_id:
                                if tcc_id not in accumulated_tool_calls:
                                    accumulated_tool_calls[tcc_id] = {
                                        "id": tcc_id,
                                        "name": tcc_name or "",
                                        "args": {},
                                        "_args_str": ""
                                    }
                                if tcc_name and not accumulated_tool_calls[tcc_id]["name"]:
                                    accumulated_tool_calls[tcc_id]["name"] = tcc_name
                                # Accumulate args string
                                if tcc_args and isinstance(tcc_args, str):
                                    accumulated_tool_calls[tcc_id]["_args_str"] += tcc_args
                                    # Try to parse as complete JSON
                                    try:
                                        parsed = json.loads(accumulated_tool_calls[tcc_id]["_args_str"])
                                        if isinstance(parsed, dict):
                                            accumulated_tool_calls[tcc_id]["args"] = parsed
                                    except json.JSONDecodeError:
                                        pass  # Not complete yet
                    
                    # Also check tool_calls for dict-format args (fallback)
                    if hasattr(message_chunk, 'tool_calls') and message_chunk.tool_calls:
                        for tc in message_chunk.tool_calls:
                            tc_id = tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None)
                            tc_name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
                            tc_args = tc.get("args") if isinstance(tc, dict) else getattr(tc, "args", None)
                            
                            if tc_id:
                                if tc_id not in accumulated_tool_calls:
                                    # Initialize with empty string for args accumulation
                                    accumulated_tool_calls[tc_id] = {
                                        "id": tc_id, 
                                        "name": tc_name or "", 
                                        "args": {},
                                        "_args_str": ""  # For accumulating JSON string fragments
                                    }
                                # Merge name if we get it
                                if tc_name and not accumulated_tool_calls[tc_id]["name"]:
                                    accumulated_tool_calls[tc_id]["name"] = tc_name
                                # Merge args - handle both dict and string formats
                                # Only merge if args is non-empty and we don't have parsed args yet
                                if tc_args and isinstance(tc_args, dict) and tc_args and not accumulated_tool_calls[tc_id]["args"]:
                                    accumulated_tool_calls[tc_id]["args"].update(tc_args)
                                elif tc_args and isinstance(tc_args, str):
                                    # Accumulate JSON string fragment
                                    accumulated_tool_calls[tc_id]["_args_str"] += tc_args
                                    # Try to parse accumulated string as complete JSON
                                    try:
                                        parsed = json.loads(accumulated_tool_calls[tc_id]["_args_str"])
                                        if isinstance(parsed, dict):
                                            accumulated_tool_calls[tc_id]["args"] = parsed
                                    except json.JSONDecodeError:
                                        # Not complete yet, keep accumulating
                                        pass
                    
                    # Serialize message to SDK-compatible format (content as array of typed blocks)
                    serialized = serialize_message_chunk_for_sdk(message_chunk)
                    # Use per-step message_id - each (langgraph_step, langgraph_node) gets unique ID
                    # This prevents different steps from overwriting each other
                    serialized["id"] = get_message_id_for_step(metadata)
                    
                    # DEBUG: Log first message chunk structure to identify reasoning location
                    if not hasattr(event_generator, '_debug_logged'):
                        event_generator._debug_logged = True
                        chunk_attrs = {attr: str(getattr(message_chunk, attr, None))[:100] 
                                      for attr in dir(message_chunk) 
                                      if not attr.startswith('_') and not callable(getattr(message_chunk, attr, None))}
                        print(f"[DEBUG] First message_chunk attributes: {list(chunk_attrs.keys())}", flush=True)
                        if hasattr(message_chunk, 'additional_kwargs'):
                            print(f"[DEBUG] additional_kwargs: {message_chunk.additional_kwargs}", flush=True)
                        if hasattr(message_chunk, 'reasoning_content'):
                            print(f"[DEBUG] reasoning_content attr: {getattr(message_chunk, 'reasoning_content', None)}", flush=True)
                    
                    # TIME-ORDERED ACCUMULATION for DB save
                    # Accumulate thinking/reasoning content FIRST (if present)
                    # DeepSeek may put reasoning in different locations:
                    # 1. additional_kwargs.reasoning_content (most common)
                    # 2. Direct message_chunk.reasoning_content attribute
                    # 3. response_metadata.reasoning_content
                    reasoning = None
                    
                    # Check additional_kwargs first
                    if hasattr(message_chunk, 'additional_kwargs') and message_chunk.additional_kwargs:
                        reasoning = message_chunk.additional_kwargs.get("reasoning_content", "")
                    
                    # Check direct attribute
                    if not reasoning and hasattr(message_chunk, 'reasoning_content'):
                        reasoning = getattr(message_chunk, 'reasoning_content', "") or ""
                    
                    # Check response_metadata
                    if not reasoning and hasattr(message_chunk, 'response_metadata') and message_chunk.response_metadata:
                        reasoning = message_chunk.response_metadata.get("reasoning_content", "")
                    
                    if reasoning:
                        accumulated_thinking += reasoning
                        # If no current thinking block, create one
                        if current_thinking_block is None:
                            current_thinking_block = {"type": "thinking", "thinking": ""}
                            time_ordered_blocks.append(current_thinking_block)
                            # When new thinking starts, close any open text block
                            current_text_block = None
                        current_thinking_block["thinking"] += reasoning
                    
                    # DELTA MODE: Accumulate text content
                    if hasattr(message_chunk, 'content') and message_chunk.content:
                        if isinstance(message_chunk.content, str) and message_chunk.content.strip():
                            accumulated_content += message_chunk.content
                            # If no current text block, create one
                            if current_text_block is None:
                                current_text_block = {"type": "text", "text": ""}
                                time_ordered_blocks.append(current_text_block)
                                # When new text starts, close any open thinking block
                                current_thinking_block = None
                            current_text_block["text"] += message_chunk.content
                    
                    # Send delta content (original token from LLM), not accumulated snapshot
                    # serialized["content"] is already set by serialize_message_chunk_for_sdk
                    
                    # Replace tool_calls AND content tool_use blocks with accumulated args
                    if hasattr(message_chunk, 'tool_calls') and message_chunk.tool_calls:
                        complete_tool_calls = []
                        for tc in message_chunk.tool_calls:
                            tc_id = tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None)
                            if tc_id and tc_id in accumulated_tool_calls:
                                acc = accumulated_tool_calls[tc_id]
                                if acc["name"]:  # Only include if we have a name
                                    complete_tool_calls.append(acc)
                                    # Add to time_ordered_blocks if not already added
                                    if tc_id not in seen_tool_ids:
                                        seen_tool_ids.add(tc_id)
                                        # Close any open thinking/text blocks when tool starts
                                        current_thinking_block = None
                                        current_text_block = None
                                        time_ordered_blocks.append({
                                            "type": "tool_use",
                                            "id": acc["id"],
                                            "name": acc["name"],
                                            "input": acc["args"]
                                        })
                        if complete_tool_calls:
                            serialized["tool_calls"] = complete_tool_calls
                            
                            # Also update tool_use blocks in content array with accumulated args
                            if "content" in serialized and isinstance(serialized["content"], list):
                                for block in serialized["content"]:
                                    if isinstance(block, dict) and block.get("type") == "tool_use":
                                        tc_id = block.get("id")
                                        if tc_id and tc_id in accumulated_tool_calls:
                                            acc = accumulated_tool_calls[tc_id]
                                            block["name"] = acc["name"]
                                            block["input"] = acc["args"]
                    
                    # Send as 2-tuple: [serialized_message, metadata]
                    yield f"event: messages\ndata: {json.dumps([serialized, metadata], ensure_ascii=False)}\n\n"
                            
                elif isinstance(chunk, tuple) and len(chunk) == 1:
                    # Only message, no metadata - use fallback ID
                    message_chunk = chunk[0]
                    serialized = serialize_message_chunk_for_sdk(message_chunk)
                    fallback_id = str(uuid.uuid4())  # No metadata available
                    serialized["id"] = fallback_id
                    yield f"event: messages\ndata: {json.dumps([serialized, {}], ensure_ascii=False)}\n\n"
                    
                    if hasattr(message_chunk, 'content') and message_chunk.content:
                        if isinstance(message_chunk.content, str):
                            accumulated_content += message_chunk.content
                            
                elif isinstance(chunk, (AIMessage, AIMessageChunk)):
                    # Direct message chunk (some graphs may yield this way)
                    serialized = serialize_message_chunk_for_sdk(chunk)
                    fallback_id = str(uuid.uuid4())  # No metadata context
                    serialized["id"] = fallback_id
                    yield f"event: messages\ndata: {json.dumps([serialized, {}], ensure_ascii=False)}\n\n"
                    
                    if chunk.content and isinstance(chunk.content, str):
                        accumulated_content += chunk.content
            
            # Try to get final state for todos/files (values event)
            import sys  # Ensure flush works
            try:
                print(f"[STREAM] Fetching final state for thread {thread_id}...", flush=True)
                final_state = await active_graph.aget_state(config)
                print(f"[STREAM] Got final_state: {type(final_state)}, has values: {hasattr(final_state, 'values') if final_state else 'N/A'}", flush=True)
                
                if final_state and hasattr(final_state, 'values'):
                    values = final_state.values
                    print(f"[STREAM] State values keys: {list(values.keys()) if values else 'None'}", flush=True)
                    values_data = {
                        "todos": values.get("todos", []),
                        "files": values.get("files", {}),
                    }
                    print(f"[STREAM] values_data: todos={len(values_data['todos'])}, files={bool(values_data['files'])}", flush=True)
                    # Always send values event (frontend may need empty state)
                    yield f"event: values\ndata: {json.dumps(values_data, ensure_ascii=False)}\n\n"
                else:
                    print(f"[STREAM] No values in final_state, sending empty values event", flush=True)
                    yield f"event: values\ndata: {json.dumps({'todos': [], 'files': {}}, ensure_ascii=False)}\n\n"
            except Exception as state_err:
                # Don't fail the stream if state fetch fails
                print(f"[STREAM] Could not fetch state for values: {state_err}", flush=True)
            
            print(f"[STREAM] Sending end event", flush=True)
            # Send end event FIRST for faster button display
            yield "event: end\ndata: {}\n\n"
            
            # Then save to history and DB (after end event, so UI is responsive)
            # Build full message_data structure from TIME-ORDERED content blocks
            if time_ordered_blocks or accumulated_content:
                # Add index to each block for SDK compatibility
                content_blocks = []
                all_tool_calls = []
                
                for i, block in enumerate(time_ordered_blocks):
                    block_with_index = {**block, "index": i}
                    content_blocks.append(block_with_index)
                    # Collect tool_calls separately
                    if block.get("type") == "tool_use":
                        all_tool_calls.append({
                            "id": block.get("id", ""),
                            "name": block.get("name", ""),
                            "args": block.get("input", {})
                        })
                
                # Fallback: if no blocks but we have accumulated_content
                if not content_blocks and accumulated_content:
                    content_blocks.append({
                        "type": "text",
                        "text": accumulated_content,
                        "index": 0
                    })
                
                # Build full message_data for DB
                message_data = {
                    "type": "ai",
                    "content": content_blocks,
                    "tool_calls": all_tool_calls,
                    "additional_kwargs": {},
                    "response_metadata": {}
                }
                
                # For backwards compat, also save simple content string
                simple_content = accumulated_content or (accumulated_thinking[:200] if accumulated_thinking else "")
                
                _append_history(thread_id, {"type": "ai", "content": simple_content})
                if user and USE_SUPABASE_DB:
                    await create_thread_message(
                        user_id=auth_get_user_id(user),
                        langgraph_thread_id=thread_id,
                        role="ai",
                        content=simple_content,
                        message_data=message_data,
                    )
            
            # NEW: Extract and save ToolMessages from graph state
            # This ensures tool results are persisted for history reload
            try:
                if final_state and hasattr(final_state, 'values'):
                    state_messages = final_state.values.get("messages", [])
                    for msg in state_messages:
                        if isinstance(msg, ToolMessage):
                            tool_content = msg.content if isinstance(msg.content, str) else str(msg.content)
                            tool_call_id = getattr(msg, 'tool_call_id', None)
                            tool_msg_id = getattr(msg, 'id', None) or f"tool-{tool_call_id}-{uuid.uuid4()}"
                            
                            # Build message_data for tool message
                            tool_message_data = {
                                "type": "tool",
                                "id": tool_msg_id,
                                "content": tool_content,
                                "tool_call_id": tool_call_id,
                            }
                            
                            _append_history(thread_id, {"type": "tool", "content": tool_content, "tool_call_id": tool_call_id})
                            if user and USE_SUPABASE_DB:
                                await create_thread_message(
                                    user_id=auth_get_user_id(user),
                                    langgraph_thread_id=thread_id,
                                    role="tool",
                                    content=tool_content[:500],  # Truncate for simple content column
                                    message_data=tool_message_data,
                                )
                            print(f"[STREAM] Saved ToolMessage: tool_call_id={tool_call_id}", flush=True)
            except Exception as tool_save_err:
                print(f"[STREAM] Error saving ToolMessages: {tool_save_err}", flush=True)
            
        except Exception as exc:
            # If messages mode fails, fall back to values mode (non-streaming)
            error_msg = str(exc)
            if "messages" in error_msg.lower() or "stream_mode" in error_msg.lower():
                # Fallback: use values mode with blocking collection
                try:
                    events = await asyncio.to_thread(
                        lambda: list(
                            active_graph.stream(
                                {"messages": [HumanMessage(content=user_text)]},
                                config=config,
                                stream_mode="values",
                            )
                        )
                    )
                    final_ai: AIMessage | None = None
                    for ev in events:
                        msgs = ev.get("messages") if isinstance(ev, dict) else None
                        if isinstance(msgs, list) and msgs:
                            last = msgs[-1]
                            if isinstance(last, AIMessage):
                                final_ai = last
                    if final_ai is not None:
                        # Use serialize function for consistency
                        serialized = serialize_message_chunk_for_sdk(final_ai)
                        serialized["id"] = str(uuid.uuid4())  # Fallback mode: unique ID
                        yield f"event: messages\ndata: {json.dumps([serialized, {}], ensure_ascii=False)}\n\n"
                        # Send end event FIRST for faster button display
                        yield "event: end\ndata: {}\n\n"
                        # Then save to DB
                        content = final_ai.content
                        _append_history(thread_id, {"type": "ai", "content": content})
                        if user and USE_SUPABASE_DB:
                            await create_thread_message(
                                user_id=auth_get_user_id(user),
                                langgraph_thread_id=thread_id,
                                role="ai",
                                content=str(content),
                            )
                    else:
                        yield "event: end\ndata: {}\n\n"
                except Exception as fallback_exc:
                    yield f"event: error\ndata: {json.dumps({'error': str(fallback_exc)}, ensure_ascii=False)}\n\n"
                    yield "event: end\ndata: {}\n\n"
            else:
                yield f"event: error\ndata: {json.dumps({'error': error_msg}, ensure_ascii=False)}\n\n"
                yield "event: end\ndata: {}\n\n"

    # SSE-specific headers to prevent buffering by proxies (nginx, Railway, CDNs)
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate, no-transform",
        "Pragma": "no-cache",  # HTTP/1.0 compatibility
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",  # Disable nginx buffering
        "Content-Encoding": "identity",  # Explicitly disable gzip/compression
        "X-Content-Type-Options": "nosniff",  # Prevent content-type sniffing
    }
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream; charset=utf-8",
        headers=headers,
    )


# =============================================================================
# Storage Backend
# =============================================================================

async def get_supabase_client():
    """Get async Supabase client instance (only when Supabase is configured)."""
    global _supabase_client
    if USE_LOCAL_STORAGE:
        return None
    if _supabase_client is None:
        from supabase import acreate_client
        _supabase_client = await acreate_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_client


def get_local_storage_path(user_id: str) -> Path:
    """Get local storage path for a user.

    In local mode, files are stored directly in LOCAL_STORAGE_DIR (sandbox data dir)
    without user subdirectories for simplicity.

    Note: Caller must ensure directory exists via _ensure_storage_dir().
    """
    return LOCAL_STORAGE_DIR


async def _ensure_storage_dir() -> None:
    """Ensure local storage directory exists (runs in thread pool)."""
    await asyncio.to_thread(LOCAL_STORAGE_DIR.mkdir, parents=True, exist_ok=True)


def _write_file_sync(path: Path, content: bytes) -> None:
    """Write file synchronously (for use with asyncio.to_thread)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(content)


def _delete_file_sync(path: Path) -> bool:
    """Delete file synchronously (for use with asyncio.to_thread)."""
    if path.exists():
        path.unlink()
        return True
    return False


def _list_files_sync(directory: Path) -> list:
    """List files synchronously (for use with asyncio.to_thread)."""
    files = []
    if directory.exists():
        for item in directory.iterdir():
            if item.is_file():
                stat = item.stat()
                files.append({
                    "name": item.name,
                    "size": stat.st_size,
                    "ctime": stat.st_ctime,
                })
    return files


# =============================================================================
# Response Models
# =============================================================================

class UploadResponse(BaseModel):
    """Response model for file upload."""
    success: bool
    filename: str
    original_filename: str
    storage_path: str
    sandbox_path: str  # Actual path where file can be accessed in sandbox
    size: int
    message: str


class FileInfo(BaseModel):
    """Information about an uploaded file."""
    filename: str
    original_filename: str
    storage_path: str
    size: int
    created_at: str


class FileListResponse(BaseModel):
    """Response model for file list."""
    files: list[FileInfo]
    total: int


class DeleteResponse(BaseModel):
    """Response model for file deletion."""
    success: bool
    message: str


class DownloadUrlResponse(BaseModel):
    """Response model for download URL."""
    url: str
    expires_in: int


# =============================================================================
# Two-Phase Upload Models (Staging Area Pattern)
# =============================================================================

class UploadInitRequest(BaseModel):
    """Request model for initializing an upload session."""
    filename: str
    size: int  # Expected file size in bytes


class UploadInitResponse(BaseModel):
    """Response model for upload initialization."""
    file_id: str
    upload_url: str  # URL to upload the file to
    ttl: int  # Time to live in seconds
    expires_at: str  # ISO timestamp when session expires


class UploadCompleteRequest(BaseModel):
    """Request model for completing an upload."""
    file_id: str


class UploadCompleteResponse(BaseModel):
    """Response model for upload completion."""
    file_id: str
    status: str  # 'uploaded' or 'error'
    filename: str
    size: int
    sandbox_path: str


class CommitFilesRequest(BaseModel):
    """Request model for committing files to a thread."""
    file_ids: list[str]
    thread_id: str  # LangGraph thread ID


class ImportFromLibraryRequest(BaseModel):
    """Request model for importing files from library."""
    file_ids: list[str]  # IDs of files in the library to import


# =============================================================================
# Helper Functions
# =============================================================================

def validate_file(file: UploadFile) -> None:
    """Validate uploaded file."""
    # Check file extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )


def generate_storage_filename(original_filename: str) -> str:
    """Generate unique storage filename."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    ext = os.path.splitext(original_filename)[1].lower()
    # Sanitize original filename (remove special characters, keep ASCII only)
    base_name = os.path.splitext(original_filename)[0]
    safe_name = "".join(c if (c.isascii() and c.isalnum()) or c in "-_" else "_" for c in base_name)
    safe_name = safe_name[:50]  # Limit length
    return f"{timestamp}_{unique_id}_{safe_name}{ext}"


def get_user_id_from_header(x_user_id: Optional[str]) -> str:
    """Get user ID from header or use default (legacy, for backward compatibility)."""
    return x_user_id or "default"


# =============================================================================
# API Routes
# =============================================================================

@app.post("/files/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    langgraph_thread_id: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    """
    Upload a data file.

    Requires authentication. User ID is extracted from JWT token.

    Storage mode is determined automatically:
    - If Supabase is configured: uploads to Supabase Storage
    - Otherwise: saves to local filesystem

    Supported formats: CSV, XLSX, XLS, DTA, SAV, Parquet
    Maximum size: 100 MB
    """
    # Validate file
    validate_file(file)

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Check file size
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB",
        )

    # Generate storage path using authenticated user ID
    user_id = auth_get_user_id(user)
    storage_filename = generate_storage_filename(file.filename)
    storage_path = f"{user_id}/{storage_filename}"

    try:
        if USE_LOCAL_STORAGE:
            # Local storage mode - use thread pool for file operations
            user_dir = get_local_storage_path(user_id)
            local_file_path = user_dir / storage_filename

            # Write file in thread pool to avoid blocking
            await asyncio.to_thread(_write_file_sync, local_file_path, content)

            print(f"[LocalStorage] File saved to: {local_file_path}")

            # In local mode, use virtual path /home/user/data/{filename}
            # The executor._rewrite_paths() will convert this to actual local path
            sandbox_path = f"/home/user/data/{storage_filename}"
        else:
            # Supabase storage mode (async)
            supabase = await get_supabase_client()

            # Determine content type
            ext = os.path.splitext(file.filename)[1].lower()
            content_types = {
                ".csv": "text/csv",
                ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xls": "application/vnd.ms-excel",
                ".dta": "application/octet-stream",
                ".sav": "application/octet-stream",
                ".parquet": "application/octet-stream",
            }
            content_type = content_types.get(ext, "application/octet-stream")

            # Upload file (async)
            await supabase.storage.from_(BUCKET_NAME).upload(
                path=storage_path,
                file=content,
                file_options={"content-type": content_type},
            )

            # In E2B mode, sandbox_path uses the virtual path convention
            sandbox_path = f"/home/user/data/{storage_filename}"

        # Save file record to database if Supabase DB is enabled
        if USE_SUPABASE_DB:
            try:
                from ..storage.supabase_db import save_file_record
                # Ensure thread record exists if the upload is associated with a thread.
                # We bind uploads to the current conversation by linking to thread_files.
                if langgraph_thread_id:
                    await create_thread(
                        user_id=user_id,
                        langgraph_thread_id=langgraph_thread_id,
                        title="New Task",
                    )

                # Determine content type
                ext = os.path.splitext(file.filename)[1].lower()
                content_types = {
                    ".csv": "text/csv",
                    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    ".xls": "application/vnd.ms-excel",
                    ".dta": "application/octet-stream",
                    ".sav": "application/octet-stream",
                    ".parquet": "application/octet-stream",
                }
                content_type = content_types.get(ext, "application/octet-stream")

                # Save to database (async)
                await save_file_record(
                    user_id=user_id,
                    filename=file.filename,
                    storage_path=storage_path,
                    file_size=file_size,
                    content_type=content_type,
                    file_type="uploaded",
                    thread_id=langgraph_thread_id,  # Treat as langgraph_thread_id for association
                )
                print(f"[Database] File record saved: {file.filename}")
            except Exception as db_error:
                # Log database error but don't fail the upload
                print(f"[Database] Warning: Failed to save file record: {db_error}")

        return UploadResponse(
            success=True,
            filename=storage_filename,
            original_filename=file.filename,
            storage_path=storage_path,
            sandbox_path=sandbox_path,
            size=file_size,
            message="File uploaded successfully",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


# =============================================================================
# Two-Phase Upload API (Staging Area Pattern)
# =============================================================================
#
# This implements the industry best practice for file uploads:
# 1. POST /uploads/init - Initialize upload session (returns file_id + upload_url)
# 2. POST /uploads/{file_id}/data - Upload the actual file data
# 3. POST /uploads/{file_id}/complete - Mark upload as complete (optional explicit call)
# 4. POST /uploads/commit - Commit files to a thread when sending message
#
# Files are staged in user's space (bound to user_id from JWT, NOT thread_id).
# They're only associated with a thread when the message is sent.
# TTL cleanup removes uncommitted files after expiration.


@app.post("/uploads/init", response_model=UploadInitResponse)
async def init_upload(
    data: UploadInitRequest,
    user: dict = Depends(get_current_user),
):
    """
    Initialize an upload session.

    This is the first step of the two-phase upload process.
    Creates a staging record and returns the file_id and upload URL.

    The upload is bound to the authenticated user (from JWT), NOT a thread.
    Thread association happens later when the message is sent.
    """
    user_id = auth_get_user_id(user)

    # Validate filename extension
    ext = os.path.splitext(data.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Check file size
    if data.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB",
        )

    # Generate unique file ID and storage path
    file_id = str(uuid.uuid4())
    storage_filename = generate_storage_filename(data.filename)
    storage_path = f"{user_id}/{storage_filename}"

    print(f"[Upload/Init] ========== UPLOAD DEBUG ==========")
    print(f"[Upload/Init] user_id = '{user_id}'")
    print(f"[Upload/Init] filename = '{data.filename}'")
    print(f"[Upload/Init] storage_path = '{storage_path}'")
    print(f"[Upload/Init] bucket = '{BUCKET_NAME}'")

    # Calculate expiration
    from datetime import timedelta
    expires_at = datetime.now() + timedelta(seconds=UPLOAD_SESSION_TTL_SECONDS)

    # Create upload session in database
    if USE_SUPABASE_DB:
        session = await create_upload_session(
            user_id=user_id,
            file_id=file_id,
            filename=data.filename,
            expected_size=data.size,
            storage_path=storage_path,
            ttl_seconds=UPLOAD_SESSION_TTL_SECONDS,
        )
        if not session:
            raise HTTPException(status_code=500, detail="Failed to create upload session")

    # The upload URL points to our own endpoint
    upload_url = f"/uploads/{file_id}/data"

    return UploadInitResponse(
        file_id=file_id,
        upload_url=upload_url,
        ttl=UPLOAD_SESSION_TTL_SECONDS,
        expires_at=expires_at.isoformat(),
    )


@app.post("/uploads/{file_id}/data", response_model=UploadCompleteResponse)
async def upload_file_data(
    file_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Upload the actual file data.

    This is the second step of the two-phase upload process.
    Receives the file content and stores it, then marks the session as uploaded.
    """
    user_id = auth_get_user_id(user)

    # Verify the upload session exists and belongs to this user
    session = await get_upload_session(file_id, user_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Upload session not found or expired",
        )

    if session["status"] != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Upload session already in status: {session['status']}",
        )

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Check file size
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB",
        )

    storage_path = session["storage_path"]
    storage_filename = os.path.basename(storage_path)

    try:
        if USE_LOCAL_STORAGE:
            # Local storage mode
            user_dir = get_local_storage_path(user_id)
            local_file_path = user_dir / storage_filename
            await asyncio.to_thread(_write_file_sync, local_file_path, content)
            sandbox_path = f"/home/user/data/{storage_filename}"
        else:
            # Supabase storage mode
            supabase = await get_supabase_client()
            ext = os.path.splitext(session["filename"])[1].lower()
            content_types = {
                ".csv": "text/csv",
                ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xls": "application/vnd.ms-excel",
                ".dta": "application/octet-stream",
                ".sav": "application/octet-stream",
                ".parquet": "application/octet-stream",
            }
            content_type = content_types.get(ext, "application/octet-stream")

            print(f"[Upload/Data] ========== STORAGE UPLOAD DEBUG ==========")
            print(f"[Upload/Data] Uploading to bucket='{BUCKET_NAME}', path='{storage_path}'")
            print(f"[Upload/Data] File size: {len(content)} bytes, content_type: {content_type}")

            await supabase.storage.from_(BUCKET_NAME).upload(
                path=storage_path,
                file=content,
                file_options={"content-type": content_type},
            )
            print(f"[Upload/Data] SUCCESS: File uploaded to Supabase Storage")
            sandbox_path = f"/home/user/data/{storage_filename}"

        # Update session status to uploaded
        await update_upload_session_status(file_id, "uploaded", actual_size=file_size)

        return UploadCompleteResponse(
            file_id=file_id,
            status="uploaded",
            filename=session["filename"],
            size=file_size,
            sandbox_path=sandbox_path,
        )

    except Exception as e:
        # Mark session as error
        await update_upload_session_status(file_id, "error")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.post("/uploads/commit")
async def commit_uploads(
    data: CommitFilesRequest,
    user: dict = Depends(get_current_user),
):
    """
    Commit uploaded files to a thread.

    This is called when a message is sent. It associates the staged files
    with the thread and creates proper file records.
    """
    user_id = auth_get_user_id(user)
    committed_files = []
    errors = []

    # Ensure thread exists once (the per-file loop is for file-level validation/commit).
    # If the LangGraph thread ID is already associated with a different user, block the commit.
    existing_thread = await get_thread_by_langgraph_id(data.thread_id) if USE_SUPABASE_DB else None
    if existing_thread and existing_thread.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to use this thread")

    await create_thread(
        user_id=user_id,
        langgraph_thread_id=data.thread_id,
        title="New Task",
    )

    for file_id in data.file_ids:
        # Verify session exists and is uploaded
        session = await get_upload_session(file_id, user_id)
        if not session:
            errors.append({"file_id": file_id, "error": "Session not found or expired"})
            continue

        if session["status"] != "uploaded":
            errors.append({"file_id": file_id, "error": f"Invalid status: {session['status']}"})
            continue

        # Create file record in files table
        if USE_SUPABASE_DB:
            from ..storage.supabase_db import save_file_record
            ext = os.path.splitext(session["filename"])[1].lower()
            content_types = {
                ".csv": "text/csv",
                ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xls": "application/vnd.ms-excel",
                ".dta": "application/octet-stream",
                ".sav": "application/octet-stream",
                ".parquet": "application/octet-stream",
            }
            content_type = content_types.get(ext, "application/octet-stream")

            await save_file_record(
                user_id=user_id,
                filename=session["filename"],
                storage_path=session["storage_path"],
                file_size=session.get("actual_size") or session["expected_size"],
                content_type=content_type,
                file_type="uploaded",
                file_id=file_id,
                thread_id=data.thread_id,
            )

        # Mark session as committed
        await commit_upload_session(file_id, data.thread_id)

        storage_filename = os.path.basename(session["storage_path"])
        committed_files.append({
            "file_id": file_id,
            "filename": session["filename"],
            "storage_path": session["storage_path"],
            "sandbox_path": f"/home/user/data/{storage_filename}",
        })

    return {
        "success": len(errors) == 0,
        "committed": committed_files,
        "errors": errors,
        "thread_id": data.thread_id,
    }


@app.post("/uploads/import-from-library")
async def import_from_library(
    data: ImportFromLibraryRequest,
    user: dict = Depends(get_current_user),
):
    """
    Import files from the user's library to be used in a new message.

    This creates staged file entries that can be committed with the message.
    Unlike regular uploads, these files already exist in storage, so we just
    create upload session records pointing to them.
    """
    user_id = auth_get_user_id(user)
    imported_files = []
    errors = []

    for file_id in data.file_ids:
        try:
            # Get the file from the library
            file_record = await get_file_by_id(file_id)
            if not file_record:
                errors.append({"file_id": file_id, "error": "File not found"})
                continue

            # Verify ownership
            if file_record.get("user_id") != user_id:
                errors.append({"file_id": file_id, "error": "Not authorized"})
                continue

            # Get file details
            filename = file_record.get("original_filename") or file_record.get("filename", "unknown")
            storage_path = file_record.get("storage_path", "")
            # DB column is file_size, not size
            file_size = file_record.get("file_size") or file_record.get("size") or 0

            # Create a new upload session that references the existing file
            # Generate a new ID for this import session
            import_session_id = str(uuid.uuid4())

            # Create session with storage_path already set (file exists)
            await create_upload_session(
                file_id=import_session_id,
                user_id=user_id,
                filename=filename,
                expected_size=file_size,
                storage_path=storage_path,
            )

            # Mark as uploaded immediately since file already exists
            await update_upload_session_status(
                file_id=import_session_id,
                status="uploaded",
                actual_size=file_size,
            )

            # Get the sandbox path
            storage_filename = os.path.basename(storage_path) if storage_path else filename
            sandbox_path = f"/home/user/data/{storage_filename}"

            imported_files.append({
                "file_id": import_session_id,
                "original_file_id": file_id,
                "filename": filename,
                "size": file_size,
                "storage_path": storage_path,
                "sandbox_path": sandbox_path,
            })

        except Exception as e:
            errors.append({"file_id": file_id, "error": str(e)})

    return {
        "success": len(errors) == 0,
        "imported": imported_files,
        "errors": errors,
    }


@app.get("/uploads/pending")
async def get_pending_uploads(user: dict = Depends(get_current_user)):
    """
    Get all pending uploads for the current user.

    Returns files that have been uploaded but not yet committed to a thread.
    """
    user_id = auth_get_user_id(user)
    pending = await get_user_pending_uploads(user_id)

    return {
        "pending": [
            {
                "file_id": p["id"],
                "filename": p["filename"],
                "status": p["status"],
                "size": p.get("actual_size") or p["expected_size"],
                "expires_at": p["expires_at"],
            }
            for p in pending
        ],
        "total": len(pending),
    }


@app.delete("/uploads/{file_id}")
async def cancel_upload(
    file_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Cancel a pending upload.

    Removes the staged file and deletes the session record.
    """
    user_id = auth_get_user_id(user)

    session = await get_upload_session(file_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")

    if session["committed"]:
        raise HTTPException(status_code=400, detail="Cannot cancel committed upload")

    # Delete the file from storage if it was uploaded
    if session["status"] == "uploaded":
        storage_path = session["storage_path"]
        try:
            if USE_LOCAL_STORAGE:
                storage_filename = os.path.basename(storage_path)
                user_dir = get_local_storage_path(user_id)
                local_file_path = user_dir / storage_filename
                await asyncio.to_thread(_delete_file_sync, local_file_path)
            else:
                supabase = await get_supabase_client()
                await supabase.storage.from_(BUCKET_NAME).remove([storage_path])
        except Exception as e:
            print(f"Warning: Failed to delete staged file: {e}")

    # Delete the session record
    if USE_SUPABASE_DB:
        supabase = await get_supabase_client()
        await supabase.table("upload_sessions").delete().eq("id", file_id).execute()

    return {"success": True, "message": "Upload cancelled"}


@app.post("/uploads/cleanup")
async def cleanup_uploads():
    """
    Clean up expired upload sessions (admin endpoint).

    Deletes expired sessions and their associated files.
    Should be called periodically via cron job.
    """
    deleted_count = await cleanup_expired_uploads()

    # TODO: Also clean up orphaned files in storage

    return {
        "success": True,
        "deleted_sessions": deleted_count,
        "message": f"Cleaned up {deleted_count} expired upload sessions",
    }


# =============================================================================
# File Preview API (for Agent Context Injection)
# =============================================================================
#
# This endpoint provides data previews that can be embedded directly in the
# Agent's context window, similar to how Gemini/ChatGPT handle file uploads.
# Instead of just passing file paths, the agent can now "see" the actual data.
#

class FilePreviewResponse(BaseModel):
    """Response model for file preview."""
    file_id: str
    filename: str
    preview: str  # Human-readable preview (first N rows as markdown/text)
    row_count: int  # Total rows in file (if applicable)
    column_count: int  # Total columns (if applicable)
    columns: list[str]  # Column names
    truncated: bool  # Whether preview is truncated
    file_size: int
    preview_rows: int  # Number of rows in preview


@app.get("/files/{file_id}/preview", response_model=FilePreviewResponse)
async def get_file_preview(
    file_id: str,
    max_rows: int = Query(10, ge=1, le=100, description="Maximum rows to include in preview"),
    user: dict = Depends(get_current_user),
):
    """
    Get a preview of a file's content for Agent context injection.

    This endpoint reads the file and returns a structured preview that can be
    embedded directly in the Agent's context window. This allows the Agent to
    "see" the data immediately, similar to Gemini/ChatGPT.

    Supported formats: CSV, Excel, Parquet, DTA, SAV

    Args:
        file_id: The upload session file ID
        max_rows: Maximum number of rows to include (default: 10, max: 100)

    Returns:
        FilePreviewResponse with preview data as markdown table
    """
    user_id = auth_get_user_id(user)

    # Get upload session to find the file
    session = await get_upload_session(file_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="File not found")

    if session["status"] not in ("uploaded", "committed"):
        raise HTTPException(status_code=400, detail="File not yet uploaded")

    storage_path = session["storage_path"]
    filename = session["filename"]
    ext = os.path.splitext(filename)[1].lower()

    try:
        # Read file content from storage
        if USE_LOCAL_STORAGE:
            storage_filename = os.path.basename(storage_path)
            user_dir = get_local_storage_path(user_id)
            local_file_path = user_dir / storage_filename

            def _read_file_sync():
                with open(local_file_path, "rb") as f:
                    return f.read()

            file_content = await asyncio.to_thread(_read_file_sync)
        else:
            supabase = await get_supabase_client()
            result = await supabase.storage.from_(BUCKET_NAME).download(storage_path)
            file_content = result

        file_size = len(file_content)

        # Parse file based on extension
        import io
        import pandas as pd

        if ext == ".csv":
            df = pd.read_csv(io.BytesIO(file_content), nrows=max_rows + 1)
        elif ext in (".xlsx", ".xls"):
            df = pd.read_excel(io.BytesIO(file_content), nrows=max_rows + 1)
        elif ext == ".parquet":
            import pyarrow.parquet as pq
            table = pq.read_table(io.BytesIO(file_content))
            df = table.to_pandas().head(max_rows + 1)
        elif ext == ".dta":
            df = pd.read_stata(io.BytesIO(file_content))
            df = df.head(max_rows + 1)
        elif ext == ".sav":
            import pyreadstat
            df, meta = pyreadstat.read_sav(io.BytesIO(file_content))
            df = df.head(max_rows + 1)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

        # Check if truncated
        truncated = len(df) > max_rows
        if truncated:
            df = df.head(max_rows)

        # Get total row count (approximate for large files)
        total_rows = len(df)
        if ext == ".csv":
            # For CSV, count newlines for approximate total
            try:
                full_df = pd.read_csv(io.BytesIO(file_content))
                total_rows = len(full_df)
            except Exception:
                pass

        # Generate markdown preview
        columns = df.columns.tolist()
        preview_md = df.to_markdown(index=False)

        return FilePreviewResponse(
            file_id=file_id,
            filename=filename,
            preview=preview_md,
            row_count=total_rows,
            column_count=len(columns),
            columns=columns,
            truncated=truncated,
            file_size=file_size,
            preview_rows=len(df),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {str(e)}")


@app.get("/files/list", response_model=FileListResponse)
async def list_files(user: dict = Depends(get_current_user)):
    """List all files uploaded by the user. Requires authentication."""
    user_id = auth_get_user_id(user)

    try:
        files = []

        if USE_LOCAL_STORAGE:
            # Local storage mode - use thread pool for file operations
            user_dir = get_local_storage_path(user_id)
            file_list = await asyncio.to_thread(_list_files_sync, user_dir)

            for item in file_list:
                # Parse original filename from storage filename
                parts = item["name"].split("_", 3)
                original_name = parts[3] if len(parts) > 3 else item["name"]

                files.append(FileInfo(
                    filename=item["name"],
                    original_filename=original_name,
                    storage_path=f"{user_id}/{item['name']}",
                    size=item["size"],
                    created_at=datetime.fromtimestamp(item["ctime"]).isoformat(),
                ))
        else:
            # Supabase storage mode (async)
            supabase = await get_supabase_client()
            result = await supabase.storage.from_(BUCKET_NAME).list(path=user_id)

            for item in result:
                if item.get("name"):
                    parts = item["name"].split("_", 3)
                    original_name = parts[3] if len(parts) > 3 else item["name"]

                    files.append(FileInfo(
                        filename=item["name"],
                        original_filename=original_name,
                        storage_path=f"{user_id}/{item['name']}",
                        size=item.get("metadata", {}).get("size", 0),
                        created_at=item.get("created_at", ""),
                    ))

        return FileListResponse(files=files, total=len(files))

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")


@app.delete("/files/{filename}", response_model=DeleteResponse)
async def delete_file(filename: str, user: dict = Depends(get_current_user)):
    """Delete a file from storage. Requires authentication."""
    user_id = auth_get_user_id(user)
    storage_path = f"{user_id}/{filename}"

    try:
        if USE_LOCAL_STORAGE:
            # Local storage mode - use thread pool for file operations
            user_dir = get_local_storage_path(user_id)
            local_file_path = user_dir / filename
            await asyncio.to_thread(_delete_file_sync, local_file_path)
        else:
            # Supabase storage mode (async)
            supabase = await get_supabase_client()
            await supabase.storage.from_(BUCKET_NAME).remove([storage_path])

        return DeleteResponse(success=True, message="File deleted successfully")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


@app.get("/files/download-url/{filename}", response_model=DownloadUrlResponse)
async def get_download_url(
    filename: str,
    user: dict = Depends(get_current_user),
    expires_in: int = 3600,
):
    """
    Get a download URL for a file. Requires authentication.

    For local storage: returns a file:// URL (for development only)
    For Supabase: returns a signed URL
    """
    user_id = auth_get_user_id(user)
    storage_path = f"{user_id}/{filename}"

    try:
        if USE_LOCAL_STORAGE:
            # Local storage mode - return file path
            user_dir = get_local_storage_path(user_id)
            local_file_path = user_dir / filename
            return DownloadUrlResponse(
                url=f"file://{local_file_path}",
                expires_in=expires_in,
            )
        else:
            # Supabase storage mode (async)
            supabase = await get_supabase_client()
            result = await supabase.storage.from_(BUCKET_NAME).create_signed_url(
                path=storage_path,
                expires_in=expires_in,
            )
            return DownloadUrlResponse(url=result["signedURL"], expires_in=expires_in)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create download URL: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "data-analyst-file-api"}


# =============================================================================
# Model Configuration Routes
# =============================================================================

class ModelInfo(BaseModel):
    """Model information for frontend display."""
    id: str
    display_name: str
    available: bool


class ModelsResponse(BaseModel):
    """Response for available models list."""
    models: list[ModelInfo]
    default_model: str | None


@app.get("/api/models", response_model=ModelsResponse)
async def get_available_models():
    """
    Get list of available language models.

    Returns models that have their API keys configured.
    Frontend uses this to populate the model selector dropdown.
    """
    from ..agent.graph import get_available_models as get_models, get_default_model_id

    models = get_models()
    default_model = get_default_model_id()

    return ModelsResponse(
        models=[ModelInfo(**m) for m in models],
        default_model=default_model,
    )


# =============================================================================
# Image Serving Routes
# =============================================================================

@app.options("/images/{image_id}")
async def image_options(image_id: str):
    """Handle CORS preflight for image endpoints."""
    return Response(
        content="",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
        },
    )


@app.get("/images/{image_id}")
async def serve_image(
    image_id: str,
    sig: str = Query(..., description="URL signature for verification"),
):
    """
    Serve an image by its ID.

    This endpoint verifies the URL signature before serving the image.
    Images are stored either locally (development) or in Supabase Storage (production).

    Security:
    - URL signature verification prevents unauthorized access
    - Image IDs are UUID-based to prevent enumeration
    - TTL-based cleanup removes old images automatically

    Args:
        image_id: Unique image identifier
        sig: HMAC signature for URL verification

    Returns:
        Image bytes with PNG content type

    Raises:
        403: Invalid signature
        404: Image not found
    """
    # Verify URL signature
    storage = get_image_storage()

    if not storage.verify_signature(image_id, sig):
        raise HTTPException(
            status_code=403,
            detail="Invalid or expired image URL",
        )

    # Get image data
    image_data = storage.get_image(image_id)

    if image_data is None:
        raise HTTPException(
            status_code=404,
            detail="Image not found or expired",
        )

    # Return image with caching and CORS headers
    return Response(
        content=image_data,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
            "X-Content-Type-Options": "nosniff",
            # Explicit CORS headers for cross-origin fetch/download
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            # Allow download with correct filename
            "Content-Disposition": f"inline; filename=\"figure_{image_id[:8]}.png\"",
        },
    )


@app.delete("/images/{image_id}")
async def delete_image(
    image_id: str,
    sig: str = Query(..., description="URL signature for verification"),
):
    """
    Delete an image by its ID.

    Args:
        image_id: Unique image identifier
        sig: HMAC signature for URL verification

    Returns:
        Success message

    Raises:
        403: Invalid signature
        404: Image not found
    """
    storage = get_image_storage()

    if not storage.verify_signature(image_id, sig):
        raise HTTPException(
            status_code=403,
            detail="Invalid or expired image URL",
        )

    success = storage.delete_image(image_id)

    if not success:
        raise HTTPException(
            status_code=404,
            detail="Image not found",
        )

    return {"success": True, "message": "Image deleted"}


@app.post("/images/cleanup")
async def cleanup_images(max_age_hours: int = 24):
    """
    Clean up old images (admin endpoint).

    This endpoint deletes images older than the specified age.
    Should be called periodically (e.g., via cron job) to prevent storage buildup.

    Args:
        max_age_hours: Maximum age of images to keep (default: 24 hours)

    Returns:
        Number of deleted images
    """
    storage = get_image_storage()
    deleted_count = storage.cleanup_old_images(max_age_hours)

    return {
        "success": True,
        "deleted_count": deleted_count,
        "message": f"Cleaned up {deleted_count} images older than {max_age_hours} hours",
    }


# =============================================================================
# Sandbox File Download Routes
# =============================================================================

@app.get("/sandbox/files/{filename}")
async def download_sandbox_file(filename: str):
    """
    Download a file from the sandbox data directory.

    This endpoint serves files created by the AI during code execution.
    Files are stored in the local data directory (sandbox).

    Args:
        filename: Name of the file to download

    Returns:
        File content with appropriate content type

    Raises:
        404: File not found
    """
    from fastapi.responses import FileResponse

    # Get the sandbox data directory
    local_file_path = LOCAL_STORAGE_DIR / filename

    # Security check: prevent path traversal
    try:
        # Resolve the path and ensure it's within LOCAL_STORAGE_DIR
        resolved_path = local_file_path.resolve()
        if not str(resolved_path).startswith(str(LOCAL_STORAGE_DIR.resolve())):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=403, detail="Invalid file path")

    if not local_file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    if not local_file_path.is_file():
        raise HTTPException(status_code=400, detail="Not a file")

    # Determine content type based on extension
    ext = local_file_path.suffix.lower()
    content_types = {
        ".csv": "text/csv",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xls": "application/vnd.ms-excel",
        ".json": "application/json",
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".html": "text/html",
        ".parquet": "application/octet-stream",
        ".dta": "application/octet-stream",
        ".sav": "application/octet-stream",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".pdf": "application/pdf",
    }
    media_type = content_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=str(local_file_path),
        filename=filename,
        media_type=media_type,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@app.get("/sandbox/files")
async def list_sandbox_files():
    """
    List all files in the sandbox data directory.

    Returns:
        List of files with their metadata
    """
    files = []

    if LOCAL_STORAGE_DIR.exists():
        for item in LOCAL_STORAGE_DIR.iterdir():
            if item.is_file():
                stat = item.stat()
                files.append({
                    "filename": item.name,
                    "size": stat.st_size,
                    "modified": stat.st_mtime,
                    "download_url": f"/sandbox/files/{item.name}",
                })

    return {"files": files, "total": len(files)}


# =============================================================================
# Generated Files Download Routes (for E2B / Production)
# =============================================================================

@app.options("/generated-files/{file_id:path}")
async def generated_file_options(file_id: str):
    """Handle CORS preflight for generated file endpoints."""
    return Response(
        content="",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
        },
    )


@app.get("/generated-files/{file_id:path}")
async def download_generated_file(
    file_id: str,
    sig: str = Query(..., description="URL signature for verification"),
):
    """
    Download an agent-generated file by its ID.

    This endpoint serves files created by the AI during code execution in E2B sandbox.
    Files are stored either locally (development) or in Supabase Storage (production).

    Security:
    - URL signature verification prevents unauthorized access
    - File IDs include user and timestamp info

    Args:
        file_id: Unique file identifier (format: user_id/timestamp_random_filename)
        sig: HMAC signature for URL verification

    Returns:
        File content with appropriate content type

    Raises:
        403: Invalid signature
        404: File not found
    """
    # Verify URL signature
    storage = get_file_storage()

    if not storage.verify_signature(file_id, sig):
        raise HTTPException(
            status_code=403,
            detail="Invalid or expired file URL",
        )

    # Get file data
    file_data = storage.get_file(file_id)

    if file_data is None:
        raise HTTPException(
            status_code=404,
            detail="File not found or expired",
        )

    # Extract filename from file_id for Content-Disposition
    # file_id format: user_id/timestamp_random_filename
    parts = file_id.split("/")
    if len(parts) >= 2:
        # Get the part after user_id/
        name_part = parts[-1]
        # Split by underscore and get everything after random part
        name_segments = name_part.split("_", 2)
        if len(name_segments) >= 3:
            filename = name_segments[2]
        else:
            filename = name_part
    else:
        filename = file_id

    # Get MIME type
    content_type = get_mime_type(filename)

    # Return file with appropriate headers
    return Response(
        content=file_data,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
            "X-Content-Type-Options": "nosniff",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Expose-Headers": "Content-Disposition",
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@app.get("/generated-files")
async def list_user_generated_files(
    user: dict = Depends(get_current_user),
):
    """
    List all generated files for a user. Requires authentication.

    Returns:
        List of files with metadata and download URLs
    """
    user_id = auth_get_user_id(user)
    files = list_generated_files(user_id)

    return {
        "files": files,
        "total": len(files),
    }


@app.post("/generated-files/cleanup")
async def cleanup_generated_files(max_age_hours: int = 72):
    """
    Clean up old generated files (admin endpoint).

    Args:
        max_age_hours: Maximum age of files to keep (default: 72 hours)

    Returns:
        Number of deleted files
    """
    storage = get_file_storage()
    deleted_count = storage.cleanup_old_files(max_age_hours)

    return {
        "success": True,
        "deleted_count": deleted_count,
        "message": f"Cleaned up {deleted_count} files older than {max_age_hours} hours",
    }


# =============================================================================
# Database-Driven File API Routes (for FilePanel categories)
# =============================================================================

class DatabaseFileInfo(BaseModel):
    """Information about a file from database."""
    id: str
    filename: str
    original_filename: Optional[str] = None
    file_type: str  # 'uploaded', 'generated', 'chart', 'code'
    storage_path: Optional[str] = None
    download_url: Optional[str] = None
    size: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: str


class DatabaseFileListResponse(BaseModel):
    """Response model for database file list."""
    files: list[DatabaseFileInfo]
    total: int
    file_type: Optional[str] = None


@app.get("/api/files/by-type", response_model=DatabaseFileListResponse)
async def get_files_by_type_api(
    file_type: Optional[str] = Query(None, description="Filter by file type: uploaded, generated, chart, code"),
    user: dict = Depends(get_current_user),
):
    """
    Get files from database filtered by type.

    This endpoint queries the files table in Supabase database,
    providing categorized access to all user files.

    File types:
    - uploaded: User-uploaded data files (CSV, Excel, etc.)
    - generated: AI-generated data files (processed datasets, exports)
    - chart: AI-generated charts and visualizations
    - code: Code execution history/snippets

    Args:
        file_type: Optional filter by file type

    Returns:
        List of files with metadata
    """
    user_id = auth_get_user_id(user)

    if not USE_SUPABASE_DB:
        # Fallback: return empty list if database is not configured
        return DatabaseFileListResponse(files=[], total=0, file_type=file_type)

    try:
        # Query database
        files_data = await get_files_by_type(
            user_id=user_id,
            file_type=file_type,  # type: ignore
        )

        # Convert to response format
        files = []
        for f in files_data:
            files.append(DatabaseFileInfo(
                id=f.get("id", ""),
                filename=f.get("filename", ""),
                original_filename=f.get("original_filename") or f.get("filename"),
                file_type=f.get("file_type", "generated"),
                storage_path=f.get("storage_path"),
                download_url=f.get("download_url") or f"/api/files/{f.get('id','')}/download",
                size=f.get("file_size"),
                mime_type=f.get("content_type"),
                created_at=f.get("created_at", ""),
            ))

        return DatabaseFileListResponse(
            files=files,
            total=len(files),
            file_type=file_type,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get files: {str(e)}")


@app.get("/api/threads/{langgraph_thread_id}/files", response_model=DatabaseFileListResponse)
async def get_thread_files_api(
    langgraph_thread_id: str,
    file_type: Optional[str] = Query(None, description="Optional filter by file type"),
    user: dict = Depends(get_current_user),
):
    """
    Get all files associated with a specific thread.

    This endpoint returns files linked to a conversation thread,
    useful for displaying context-aware file lists in chat UI.

    Args:
        thread_id: The thread/conversation ID
        file_type: Optional filter by file type

    Returns:
        List of files associated with the thread
    """
    user_id = auth_get_user_id(user)

    if not USE_SUPABASE_DB:
        return DatabaseFileListResponse(files=[], total=0, file_type=file_type)

    try:
        thread_record = await get_thread_by_langgraph_id(langgraph_thread_id)
        if not thread_record:
            return DatabaseFileListResponse(files=[], total=0, file_type=file_type)
        if thread_record["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")

        # Query database for thread files using DB thread UUID
        files_data = await get_thread_files(thread_id=thread_record["id"])

        # Optional filter by file_type
        if file_type:
            files_data = [f for f in files_data if f.get("file_type") == file_type]

        # Convert to response format
        files = []
        for f in files_data:
            files.append(DatabaseFileInfo(
                id=f.get("id", ""),
                filename=f.get("filename", ""),
                original_filename=f.get("original_filename") or f.get("filename"),
                file_type=f.get("file_type", "generated"),
                storage_path=f.get("storage_path"),
                download_url=f.get("download_url") or f"/api/files/{f.get('id','')}/download",
                size=f.get("file_size"),
                mime_type=f.get("content_type"),
                created_at=f.get("created_at", ""),
            ))

        return DatabaseFileListResponse(
            files=files,
            total=len(files),
            file_type=file_type,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get thread files: {str(e)}")


@app.get("/api/files", response_model=DatabaseFileListResponse)
async def list_files_api(
    types: Optional[str] = Query(None, description="Comma-separated file types to include"),
    user: dict = Depends(get_current_user),
):
    """List user's files from the database (DB-driven library)."""
    user_id = auth_get_user_id(user)
    if not USE_SUPABASE_DB:
        return DatabaseFileListResponse(files=[], total=0, file_type=None)
    file_types: Optional[list[FileType]] = None
    if types:
        requested = [t.strip() for t in types.split(",") if t.strip()]
        file_types = [t for t in requested if t in ("uploaded", "generated", "chart", "code")]  # type: ignore
    files_data = await get_user_files(user_id=user_id, file_types=file_types)
    files: list[DatabaseFileInfo] = []
    for f in files_data:
        files.append(DatabaseFileInfo(
            id=f.get("id", ""),
            filename=f.get("filename", ""),
            original_filename=f.get("original_filename") or f.get("filename"),
            file_type=f.get("file_type", "generated"),
            storage_path=f.get("storage_path"),
            download_url=f.get("download_url") or f"/api/files/{f.get('id','')}/download",
            size=f.get("file_size"),
            mime_type=f.get("content_type"),
            created_at=f.get("created_at", ""),
        ))
    return DatabaseFileListResponse(files=files, total=len(files))


@app.get("/api/files/{file_id}/usage-count")
async def get_file_usage_count_api(
    file_id: str,
    user: dict = Depends(get_current_user),
):
    user_id = auth_get_user_id(user)
    if not USE_SUPABASE_DB:
        return {"count": 0}
    count = await count_file_thread_links(file_id=file_id, user_id=user_id)
    return {"count": count}


@app.delete("/api/threads/{langgraph_thread_id}/files/{file_id}")
async def unlink_thread_file_api(
    langgraph_thread_id: str,
    file_id: str,
    user: dict = Depends(get_current_user),
):
    """Remove a file association from a thread (local delete)."""
    user_id = auth_get_user_id(user)
    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")
    thread_record = await get_thread_by_langgraph_id(langgraph_thread_id)
    if not thread_record:
        raise HTTPException(status_code=404, detail="Thread not found")
    if thread_record["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    await delete_thread_file_link(thread_db_id=thread_record["id"], file_id=file_id)
    return {"success": True}


@app.delete("/api/files/{file_id}")
async def delete_file_global_api(
    file_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a file globally: remove from storage + delete DB record (cascades thread_files)."""
    user_id = auth_get_user_id(user)
    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")
    record = await get_file_by_id(file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    if record.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    bucket = record.get("bucket")
    storage_path = record.get("storage_path")
    file_type = record.get("file_type")
    if not bucket:
        if file_type == "uploaded":
            bucket = BUCKET_NAME
        elif file_type in ("generated", "code"):
            bucket = "data-analyst-generated"
        elif file_type == "chart":
            bucket = "data-analyst-images"

    # Best-effort storage delete; DB delete is the source of truth.
    try:
        if not USE_LOCAL_STORAGE and storage_path and bucket:
            supabase = await get_supabase_client()
            if supabase:
                await supabase.storage.from_(bucket).remove([storage_path])
    except Exception:
        pass

    deleted = await delete_file_record(file_id=file_id, user_id=user_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete file record")
    return {"success": True}


@app.get("/api/files/{file_id}/download")
async def download_file_api(
    file_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Authenticated download endpoint (fixed URL stored in DB).
    This endpoint can redirect to a signed URL for Supabase Storage.
    """
    user_id = auth_get_user_id(user)
    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")
    record = await get_file_by_id(file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    if record.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    bucket = record.get("bucket")
    storage_path = record.get("storage_path")
    file_type = record.get("file_type")
    if not bucket:
        if file_type == "uploaded":
            bucket = BUCKET_NAME
        elif file_type in ("generated", "code"):
            bucket = "data-analyst-generated"
        elif file_type == "chart":
            bucket = "data-analyst-images"

    if USE_LOCAL_STORAGE:
        raise HTTPException(status_code=501, detail="Local download not implemented for DB mode")

    supabase = await get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Storage not configured")

    if not storage_path or not bucket:
        raise HTTPException(status_code=500, detail="Missing storage metadata")

    result = await supabase.storage.from_(bucket).create_signed_url(
        path=storage_path,
        expires_in=3600,
    )
    signed = result.get("signedURL") or result.get("signedUrl")
    if not signed:
        raise HTTPException(status_code=500, detail="Failed to create download URL")
    return RedirectResponse(url=signed, status_code=307)


# =============================================================================
# Thread Management Routes
# =============================================================================

class ThreadCreate(BaseModel):
    """Request model for creating a thread."""
    langgraph_thread_id: str
    title: str = "New Task"
    mode: str = "default"  # "default" or "web-dev"


class ThreadInfo(BaseModel):
    """Thread information response model."""
    id: str
    user_id: str
    title: str
    langgraph_thread_id: str
    mode: str = "default"  # "default" or "web-dev"
    model_id: Optional[str] = None  # Per-thread model preference
    created_at: str
    updated_at: str


class ThreadListResponse(BaseModel):
    """Response model for thread list."""
    threads: list[ThreadInfo]
    total: int


class ThreadUpdateRequest(BaseModel):
    """Request model for updating thread."""
    title: Optional[str] = None
    model_id: Optional[str] = None  # Per-thread model preference


@app.post("/api/threads", response_model=ThreadInfo)
async def create_thread_api(
    data: ThreadCreate,
    user: dict = Depends(get_current_user),
):
    """
    Create a new thread record in the database.

    This endpoint should be called when a new conversation starts.
    It creates the thread record that file associations will reference.

    Args:
        data: Thread creation data (langgraph_thread_id, title, mode)
        user: Authenticated user

    Returns:
        Created thread record
    """
    user_id = auth_get_user_id(user)

    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        # If the thread already exists, only the owner can reuse it.
        existing = await get_thread_by_langgraph_id(data.langgraph_thread_id)
        if existing:
            if existing.get("user_id") != user_id:
                raise HTTPException(status_code=403, detail="Not authorized")
            thread_record = existing
        else:
            thread_record = await create_thread(
                user_id=user_id,
                langgraph_thread_id=data.langgraph_thread_id,
                title=data.title,
                mode=data.mode,
            )

        if not thread_record:
            raise HTTPException(status_code=500, detail="Failed to create thread")

        return ThreadInfo(
            id=thread_record["id"],
            user_id=thread_record["user_id"],
            title=thread_record["title"],
            langgraph_thread_id=thread_record["langgraph_thread_id"],
            mode=thread_record.get("mode", "default"),
            created_at=thread_record["created_at"],
            updated_at=thread_record["updated_at"],
        )

    except Exception as e:
        # Return more detailed error for debugging
        raise HTTPException(status_code=500, detail=f"Failed to create thread: {str(e)}")


@app.get("/api/threads", response_model=ThreadListResponse)
async def list_threads_api(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: dict = Depends(get_current_user),
):
    """
    List user's threads.

    Args:
        limit: Maximum number of threads to return
        offset: Offset for pagination
        user: Authenticated user

    Returns:
        List of user's threads
    """
    user_id = auth_get_user_id(user)

    if not USE_SUPABASE_DB:
        return ThreadListResponse(threads=[], total=0)

    try:
        threads_data = await get_user_threads(
            user_id=user_id,
            limit=limit,
            offset=offset,
        )

        threads = []
        for t in threads_data:
            threads.append(ThreadInfo(
                id=t["id"],
                user_id=t["user_id"],
                title=t["title"],
                langgraph_thread_id=t["langgraph_thread_id"],
                mode=t.get("mode", "default"),
                created_at=t["created_at"],
                updated_at=t["updated_at"],
            ))

        return ThreadListResponse(
            threads=threads,
            total=len(threads),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list threads: {str(e)}")


@app.get("/api/threads/{langgraph_thread_id}", response_model=ThreadInfo)
async def get_thread_api(
    langgraph_thread_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Get a specific thread by its LangGraph ID.

    Args:
        langgraph_thread_id: The LangGraph thread ID
        user: Authenticated user

    Returns:
        Thread record
    """
    user_id = auth_get_user_id(user)

    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        thread_record = await get_thread_by_langgraph_id(langgraph_thread_id)

        if not thread_record:
            raise HTTPException(status_code=404, detail="Thread not found")

        # Verify ownership
        if thread_record["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")

        return ThreadInfo(
            id=thread_record["id"],
            user_id=thread_record["user_id"],
            title=thread_record["title"],
            langgraph_thread_id=thread_record["langgraph_thread_id"],
            mode=thread_record.get("mode", "default"),
            model_id=thread_record.get("model_id"),
            created_at=thread_record["created_at"],
            updated_at=thread_record["updated_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get thread: {str(e)}")


@app.patch("/api/threads/{langgraph_thread_id}", response_model=ThreadInfo)
async def update_thread_api(
    langgraph_thread_id: str,
    data: ThreadUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """
    Update a thread's properties.

    Args:
        langgraph_thread_id: The LangGraph thread ID
        data: Update data (currently only title)
        user: Authenticated user

    Returns:
        Updated thread record
    """
    user_id = auth_get_user_id(user)

    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        # Verify thread exists and user owns it
        thread_record = await get_thread_by_langgraph_id(langgraph_thread_id)

        if not thread_record:
            raise HTTPException(status_code=404, detail="Thread not found")

        if thread_record["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")

        # Update title if provided
        if data.title:
            success = await update_thread_title(langgraph_thread_id, data.title)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to update thread")

        # Update model_id if provided (for per-thread model preference)
        if data.model_id is not None:
            from ..storage.supabase_db import update_thread_model_id
            success = await update_thread_model_id(langgraph_thread_id, data.model_id)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to update thread model")

        # Fetch updated record
        updated_record = await get_thread_by_langgraph_id(langgraph_thread_id)

        return ThreadInfo(
            id=updated_record["id"],
            user_id=updated_record["user_id"],
            title=updated_record["title"],
            langgraph_thread_id=updated_record["langgraph_thread_id"],
            mode=updated_record.get("mode", "default"),
            model_id=updated_record.get("model_id"),
            created_at=updated_record["created_at"],
            updated_at=updated_record["updated_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update thread: {str(e)}")


@app.delete("/api/threads/{langgraph_thread_id}")
async def delete_thread_api(
    langgraph_thread_id: str,
    delete_orphan_files: bool = Query(False, description="If true, also delete files only used by this thread"),
    user: dict = Depends(get_current_user),
):
    """
    Delete a thread owned by the current user.

    Default behavior deletes only the thread record (and cascaded thread_files), and does NOT delete files/storage
    because files may be reused across threads.
    """
    user_id = auth_get_user_id(user)
    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")

    thread_record = await get_thread_by_langgraph_id(langgraph_thread_id)
    if not thread_record:
        raise HTTPException(status_code=404, detail="Thread not found")
    if thread_record.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    thread_db_id = thread_record["id"]

    files_snapshot: list[dict] = []
    if delete_orphan_files:
        files_snapshot = await get_thread_files(thread_id=thread_db_id)

    deleted = await delete_thread_record(thread_db_id=thread_db_id, user_id=user_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete thread")

    if delete_orphan_files and files_snapshot:
        supabase = await get_supabase_client()
        for f in files_snapshot:
            file_id = f.get("id")
            if not file_id:
                continue
            if f.get("user_id") != user_id:
                continue
            if await count_file_thread_links(file_id=file_id, user_id=user_id) != 0:
                continue

            bucket = f.get("bucket")
            storage_path = f.get("storage_path")
            file_type = f.get("file_type")
            if not bucket:
                if file_type == "uploaded":
                    bucket = BUCKET_NAME
                elif file_type in ("generated", "code"):
                    bucket = "data-analyst-generated"
                elif file_type == "chart":
                    bucket = "data-analyst-images"

            try:
                if not USE_LOCAL_STORAGE and storage_path and bucket and supabase:
                    await supabase.storage.from_(bucket).remove([storage_path])
            except Exception:
                pass

            await delete_file_record(file_id=file_id, user_id=user_id)

    return {"success": True}


# =============================================================================
# AI-Generated Thread Title
# =============================================================================

class GenerateTitleRequest(BaseModel):
    """Request model for generating thread title."""
    user_message: str  # The user's first message to generate title from


class GenerateTitleResponse(BaseModel):
    """Response model for generated title."""
    title: str
    generated: bool


async def _generate_title_with_llm(user_message: str) -> str:
    """
    Use LLM to generate a concise title from the user's message.

    Falls back to truncating the message if LLM fails.
    """
    try:
        from langchain.chat_models import init_chat_model

        # Use a fast, cheap model for title generation
        if os.environ.get("DEEPSEEK_API_KEY"):
            model = init_chat_model(
                "deepseek-chat",
                model_provider="deepseek",
                api_key=os.environ.get("DEEPSEEK_API_KEY"),
                timeout=30,
            )
        elif os.environ.get("ANTHROPIC_API_KEY"):
            model = init_chat_model(
                "claude-3-5-haiku-latest",
                model_provider="anthropic",
                api_key=os.environ.get("ANTHROPIC_API_KEY"),
                base_url=os.environ.get("ANTHROPIC_BASE_URL"),
                timeout=30,
            )
        elif os.environ.get("OPENAI_API_KEY"):
            model = init_chat_model(
                "gpt-4o-mini",
                model_provider="openai",
                api_key=os.environ.get("OPENAI_API_KEY"),
                timeout=30,
            )
        else:
            # No LLM available, fallback to truncation
            return _truncate_message(user_message)

        # Generate title
        from langchain_core.messages import SystemMessage, HumanMessage

        response = await model.ainvoke([
            SystemMessage(content="""Generate a concise but descriptive title (7-15 Chinese characters or 5-8 English words) for this conversation.

Rules:
- Include both the action AND the subject/topic
- Be specific enough to distinguish from other conversations
- Use the same language as the user's message
- Do NOT use quotes or punctuation
- Just output the title, nothing else

Examples:
- "帮我分析这个销售数据" → "销售数据趋势分析与洞察"
- "Analyze my sales data" → "Sales Data Trend Analysis"
- "帮我写一个Python爬虫" → "Python网页爬虫开发"
- "Write a React component for login" → "React Login Component Development"
- "解释一下量子计算的原理" → "量子计算原理详解"
- "帮我翻译这篇文章" → "文章翻译与润色"
"""),
            HumanMessage(content=user_message),
        ])

        title = response.content.strip()
        # Clean up: remove quotes if present
        title = title.strip('"\'')
        # Limit length
        if len(title) > 50:
            title = title[:47] + "..."

        return title if title else _truncate_message(user_message)

    except Exception as e:
        print(f"[GenerateTitle] LLM failed: {e}, falling back to truncation")
        return _truncate_message(user_message)


def _truncate_message(message: str) -> str:
    """Truncate message to create a simple title."""
    # Remove newlines and extra spaces
    clean = " ".join(message.split())
    if len(clean) <= 20:
        return clean
    return clean[:17] + "..."


@app.post("/api/threads/{langgraph_thread_id}/generate-title", response_model=GenerateTitleResponse)
async def generate_thread_title_api(
    langgraph_thread_id: str,
    data: GenerateTitleRequest,
    user: dict = Depends(get_current_user),
):
    """
    Generate and update thread title using AI.

    This endpoint uses LLM to generate a concise, descriptive title
    based on the user's first message, then updates the thread.

    Args:
        langgraph_thread_id: The LangGraph thread ID
        data: Contains user_message to generate title from
        user: Authenticated user

    Returns:
        Generated title and whether it was applied
    """
    user_id = auth_get_user_id(user)

    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        # Verify thread exists and user owns it
        thread_record = await get_thread_by_langgraph_id(langgraph_thread_id)

        if not thread_record:
            raise HTTPException(status_code=404, detail="Thread not found")

        if thread_record["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")

        # Only generate if title is still default
        current_title = thread_record.get("title", "")
        normalized = current_title.strip().lower() if current_title else ""
        if normalized and normalized not in {"new task", "新任务"}:
            # Title already customized, don't overwrite
            return GenerateTitleResponse(title=current_title, generated=False)

        # Generate title using LLM
        new_title = await _generate_title_with_llm(data.user_message)

        # Update thread title
        success = await update_thread_title(langgraph_thread_id, new_title)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to update thread title")

        return GenerateTitleResponse(title=new_title, generated=True)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate title: {str(e)}")


# =============================================================================
# Suggested Follow-up Questions
# =============================================================================

class SuggestedQuestionsRequest(BaseModel):
    """Request model for generating suggested questions."""
    ai_response: str
    conversation_context: Optional[str] = None


class SuggestedQuestionsResponse(BaseModel):
    """Response model for suggested questions."""
    questions: list[str]


async def _generate_suggested_questions(ai_response: str, context: str = "") -> list[str]:
    """
    Use LLM to generate 3 suggested follow-up questions based on AI response.
    
    Returns a list of 3 questions, or empty list on failure.
    """
    try:
        from langchain.chat_models import init_chat_model
        from langchain_core.messages import SystemMessage, HumanMessage

        # Use a fast, cheap model
        if os.environ.get("DEEPSEEK_API_KEY"):
            model = init_chat_model(
                "deepseek-chat",
                model_provider="deepseek",
                api_key=os.environ.get("DEEPSEEK_API_KEY"),
                timeout=30,
            )
        elif os.environ.get("ANTHROPIC_API_KEY"):
            model = init_chat_model(
                "claude-3-5-haiku-latest",
                model_provider="anthropic",
                api_key=os.environ.get("ANTHROPIC_API_KEY"),
                base_url=os.environ.get("ANTHROPIC_BASE_URL"),
                timeout=30,
            )
        elif os.environ.get("OPENAI_API_KEY"):
            model = init_chat_model(
                "gpt-4o-mini",
                model_provider="openai",
                api_key=os.environ.get("OPENAI_API_KEY"),
                timeout=30,
            )
        else:
            return []

        # Truncate context if too long
        max_context = 2000
        truncated_response = ai_response[:max_context] if len(ai_response) > max_context else ai_response

        response = await model.ainvoke([
            SystemMessage(content="""基于AI的回复内容，生成3个用户可能想继续问的后续问题。

规则：
- 问题要与AI回复的内容相关
- 问题要有深度，能够延续对话
- 使用与AI回复相同的语言（中文或英文）
- 每个问题15-40个字符
- 直接输出3个问题，每行一个
- 不要加序号、引号或其他格式

示例输出：
这个方法在大数据量下性能如何？
能否用其他语言实现相同功能？
这种方案的安全性考虑有哪些？"""),
            HumanMessage(content=f"AI回复:\n{truncated_response}"),
        ])

        # Parse response into list of questions
        content = response.content.strip()
        lines = [line.strip() for line in content.split("\n") if line.strip()]
        
        # Take first 3 non-empty lines
        questions = []
        for line in lines:
            # Remove common prefixes like "1.", "-", "•", etc.
            clean = line.lstrip("0123456789.-•·）) ")
            if clean and len(clean) > 5:
                questions.append(clean)
            if len(questions) >= 3:
                break
        
        return questions[:3]

    except Exception as e:
        print(f"[SuggestedQuestions] LLM failed: {e}")
        return []


@app.post("/api/threads/{langgraph_thread_id}/generate-suggestions", response_model=SuggestedQuestionsResponse)
async def generate_suggested_questions_api(
    langgraph_thread_id: str,
    data: SuggestedQuestionsRequest,
    user: dict = Depends(get_current_user),
):
    """
    Generate suggested follow-up questions based on the AI's response.
    
    This endpoint uses LLM to generate 3 relevant follow-up questions
    that the user might want to ask next.
    """
    user_id = auth_get_user_id(user)

    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")

    try:
        # Verify thread exists and user owns it
        thread_record = await get_thread_by_langgraph_id(langgraph_thread_id)

        if not thread_record:
            raise HTTPException(status_code=404, detail="Thread not found")

        if thread_record["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")

        # Generate questions
        questions = await _generate_suggested_questions(
            ai_response=data.ai_response,
            context=data.conversation_context or ""
        )

        return SuggestedQuestionsResponse(questions=questions)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[SuggestedQuestions] Error: {e}")
        # Return empty list on error, don't fail the request
        return SuggestedQuestionsResponse(questions=[])


# =============================================================================
# Share Link Endpoints
# =============================================================================

class ShareResponse(BaseModel):
    """Response model for share link creation."""
    share_id: str
    share_url: str
    created_at: str


class ShareRequest(BaseModel):
    """Request model for share link creation."""
    message_index: Optional[int] = None  # If provided, share only this message pair


class SharedConversationResponse(BaseModel):
    """Response model for viewing a shared conversation."""
    title: str
    messages: list
    shared_at: str
    message_index: Optional[int] = None  # If set, only show this message pair


@app.post("/api/threads/{langgraph_thread_id}/share", response_model=ShareResponse)
async def create_share_link(
    langgraph_thread_id: str,
    request: Request,
    body: Optional[ShareRequest] = None,
    user: dict = Depends(get_current_user),
):
    """
    Create a share link for a thread or a single message.
    Only the thread owner can create share links.
    
    If message_index is provided in the body, only that message pair (user question + AI response) 
    will be visible in the shared link.
    """
    user_id = auth_get_user_id(user)
    
    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    # Verify thread exists and user owns it
    thread_record = await get_thread_by_langgraph_id(langgraph_thread_id)
    if not thread_record:
        raise HTTPException(status_code=404, detail="Thread not found")
    if thread_record.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get message_index from request body if provided
    message_index = body.message_index if body else None
    
    # Create the share
    from ..storage.supabase_db import create_share
    share = await create_share(
        user_id=user_id, 
        thread_id=langgraph_thread_id,
        message_index=message_index,
    )
    
    if not share:
        raise HTTPException(status_code=500, detail="Failed to create share link")
    
    # Build share URL
    # Use request origin or frontend URL
    base_url = str(request.base_url).rstrip("/")
    # For production, use the frontend URL pattern
    share_url = f"{base_url.replace('/api', '')}/share/{share['share_id']}"
    
    return ShareResponse(
        share_id=share["share_id"],
        share_url=share_url,
        created_at=share["created_at"],
    )


@app.get("/api/share/{share_id}", response_model=SharedConversationResponse)
async def get_shared_conversation(share_id: str):
    """
    Get a shared conversation by share ID.
    This endpoint is PUBLIC - no authentication required.
    Returns 404 if the share doesn't exist or the original thread was deleted.
    """
    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    # Get the share record
    from ..storage.supabase_db import get_share_by_id
    share = await get_share_by_id(share_id)
    
    if not share:
        raise HTTPException(status_code=404, detail="分享链接不存在")
    
    # Check if the original thread still exists
    thread_record = await get_thread_by_langgraph_id(share["thread_id"])
    if not thread_record:
        raise HTTPException(status_code=404, detail="该对话已被删除")
    
    # Get messages from LangGraph
    try:
        from langgraph_sdk import get_client
        
        # Use LANGGRAPH_API_URL if set, otherwise use localhost
        # In LangGraph Platform, the server runs on port 2024 by default
        langgraph_url = os.environ.get("LANGGRAPH_API_URL", "http://localhost:2024")
        client = get_client(url=langgraph_url)
        
        # Get thread state which includes messages
        thread_state = await client.threads.get_state(share["thread_id"])
        messages = thread_state.get("values", {}).get("messages", [])
        
        # Convert messages to serializable format
        serialized_messages = []
        for msg in messages:
            if hasattr(msg, "dict"):
                serialized_messages.append(msg.dict())
            elif isinstance(msg, dict):
                serialized_messages.append(msg)
            else:
                serialized_messages.append({"type": "unknown", "content": str(msg)})
        
        return SharedConversationResponse(
            title=thread_record.get("title", "分享的对话"),
            messages=serialized_messages,
            shared_at=share["created_at"],
            message_index=share.get("message_index"),  # For single message sharing
        )
    except Exception as e:
        print(f"[Share] Failed to get messages: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load conversation: {str(e)}")


@app.delete("/api/shares/{share_id}")
async def delete_share_link(
    share_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Delete a share link.
    Only the share owner can delete it.
    """
    user_id = auth_get_user_id(user)
    
    if not USE_SUPABASE_DB:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    from ..storage.supabase_db import delete_share
    success = await delete_share(share_id=share_id, user_id=user_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete share link")
    
    return {"success": True, "message": "Share link deleted"}
