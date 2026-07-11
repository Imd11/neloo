"""
Message Persistence Middleware

Automatically persists messages:
- Human messages before agent execution (via abefore_agent)
- AI messages after model calls (via awrap_model_call)

Uses the persist_chat_message Supabase RPC for atomic saving.
"""

import json
import threading
from typing import Any, Callable, Dict

from langchain.agents.middleware.types import AgentMiddleware
from langchain_core.messages import AIMessage, HumanMessage


def _safe_prefix(val: Any, length: int = 8) -> str:
    """Safely get first N chars of a value, or 'missing'."""
    if val is None:
        return "missing"
    s = str(val)
    return s[:length] if s else "missing"


class MessagePersistenceMiddleware(AgentMiddleware):
    """
    Middleware that persists messages automatically.

    - Human messages: saved in abefore_agent (before agent runs)
    - AI messages: saved in awrap_model_call (after model returns)
    """

    def _debug_log_config(self, runtime: Any, location: str) -> None:
        """Print minimal structured debug log for config inspection."""
        config = getattr(runtime, "config", None)

        debug_info = {
            "loc": location,
            "thread": threading.current_thread().name,
            "runtime_type": type(runtime).__name__ if runtime else "None",
            "has_config": config is not None,
            "config_type": type(config).__name__ if config else "None",
        }

        if config is not None:
            if isinstance(config, dict):
                debug_info["config_keys"] = list(config.keys())[:10]
                configurable = config.get("configurable", {})
                if isinstance(configurable, dict):
                    debug_info["configurable_keys"] = list(configurable.keys())[:10]
                    debug_info["cfg_thread_id"] = _safe_prefix(configurable.get("thread_id"))
                    debug_info["cfg_run_id"] = _safe_prefix(configurable.get("run_id"))
            else:
                # config might be RunnableConfig object
                try:
                    if hasattr(config, "get"):
                        configurable = config.get("configurable", {})
                        if configurable:
                            debug_info["cfg_thread_id"] = _safe_prefix(
                                configurable.get("thread_id")
                            )
                            debug_info["cfg_run_id"] = _safe_prefix(configurable.get("run_id"))
                except Exception as e:
                    debug_info["config_error"] = str(e)[:30]

        print(f"[PersistMiddleware:DEBUG] {json.dumps(debug_info)}")

    def _get_context(self, runtime: Any) -> tuple[str, str]:
        """Extract thread_id and run_id from runtime config."""
        config = getattr(runtime, "config", None) or {}
        configurable = config.get("configurable", {})
        thread_id = configurable.get("thread_id", "")
        run_id = configurable.get("run_id") or str(config.get("run_id", ""))

        if not run_id:
            import time

            run_id = f"{thread_id}:{int(time.time() * 1000)}"

        return thread_id, run_id

    async def abefore_agent(self, state: Dict[str, Any], runtime: Any) -> Dict[str, Any] | None:
        """
        Save human messages before agent execution.

        Only saves NEW human messages (the last one if it's human).
        This avoids write amplification from re-saving old messages.
        """
        # DEBUG: Log config structure
        self._debug_log_config(runtime, "abefore_agent")

        thread_id, run_id = self._get_context(runtime)

        if not thread_id or thread_id == "default":
            print(f"[PersistMiddleware] SKIP human: No valid thread_id (got: '{thread_id}')")
            return None

        messages = state.get("messages", [])
        if not messages:
            return None

        # Only save the LAST message if it's a human message
        # (This is the new input message from this run)
        last_msg = messages[-1]

        is_human = False
        if isinstance(last_msg, HumanMessage):
            is_human = True
        elif isinstance(last_msg, dict) and last_msg.get("type") in ("human", "user"):
            is_human = True
        elif hasattr(last_msg, "type") and getattr(last_msg, "type", "") in ("human", "user"):
            is_human = True

        if is_human:
            try:
                await self._persist_human_message(last_msg, thread_id, run_id)
            except Exception as e:
                print(f"[PersistMiddleware] ERROR persisting human message: {e}")

        return None  # Don't modify state

    async def _persist_human_message(
        self,
        message: Any,
        thread_id: str,
        run_id: str,
    ) -> None:
        """Persist a human message."""
        from .message_persistence import (
            persist_message_atomic,
            sanitize_hidden_prompt_message_data,
            serialize_message,
        )

        # For human messages, we MUST use the frontend-provided id
        if isinstance(message, dict):
            msg_id = message.get("id")
        else:
            msg_id = getattr(message, "id", None)

        if not msg_id or not isinstance(msg_id, str) or not msg_id.strip():
            print(
                "[PersistMiddleware] ERROR: Human message has no stable id - frontend must provide id"
            )
            print(f"  thread_id={_safe_prefix(thread_id)}, run_id={_safe_prefix(run_id)}")
            return

        # Serialize message
        message_data = serialize_message(message)
        if not message_data:
            print("[PersistMiddleware] SKIP: Cannot serialize human message")
            return

        # Ensure correct id and type
        message_data["id"] = msg_id
        message_data["type"] = "human"  # Ensure consistent type
        message_data = sanitize_hidden_prompt_message_data(message_data)

        # DEBUG: Log before persist
        print(
            f"[PersistMiddleware:PERSIST] thread_id={_safe_prefix(thread_id)}, run_id={_safe_prefix(run_id)}, message_id={_safe_prefix(msg_id)}, role=user"
        )

        # Persist
        await persist_message_atomic(thread_id, msg_id, "user", message_data)

    async def awrap_model_call(
        self,
        request: Any,  # ModelRequest
        handler: Callable,
    ) -> Any:
        """Intercept model call to persist AI response."""
        # DEBUG: Log config structure
        self._debug_log_config(request.runtime, "awrap_model_call")

        # Call the model
        response = await handler(request)

        # Get AI message from response
        ai_messages = response.result if hasattr(response, "result") else []

        # Get context from runtime
        thread_id, run_id = self._get_context(request.runtime)

        if not thread_id or thread_id == "default":
            print(f"[PersistMiddleware] SKIP AI: No valid thread_id (got: '{thread_id}')")
            return response

        # Persist each AI message
        for i, msg in enumerate(ai_messages):
            if isinstance(msg, AIMessage) or (
                hasattr(msg, "type") and getattr(msg, "type", "") == "ai"
            ):
                try:
                    await self._persist_ai_message(msg, thread_id, run_id, i)
                except Exception as e:
                    print(f"[PersistMiddleware] ERROR persisting AI message: {e}")

        return response

    async def _persist_ai_message(
        self,
        message: Any,
        thread_id: str,
        run_id: str,
        index: int,
    ) -> None:
        """Persist an AI message."""
        from .message_persistence import (
            generate_stable_message_id,
            persist_message_atomic,
            serialize_message,
        )

        # Generate stable message_id: run_id:ai for AI messages
        try:
            message_id = generate_stable_message_id(message, run_id, index)
        except ValueError as e:
            print(f"[PersistMiddleware] SKIP AI message: {e}")
            return

        # Serialize message
        message_data = serialize_message(message)
        if not message_data:
            print("[PersistMiddleware] SKIP: Cannot serialize AI message")
            return

        # Ensure stable id and correct type
        message_data["id"] = message_id
        message_data["type"] = "ai"  # Ensure consistent type

        # DEBUG: Log before persist
        print(
            f"[PersistMiddleware:PERSIST] thread_id={_safe_prefix(thread_id)}, run_id={_safe_prefix(run_id)}, message_id={_safe_prefix(message_id)}, role=assistant"
        )

        # Persist
        await persist_message_atomic(thread_id, message_id, "assistant", message_data)
