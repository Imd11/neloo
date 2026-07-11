"""
E2B Sandbox Backend for DeepAgents FilesystemMiddleware

This module implements SandboxBackendProtocol using E2B sandbox,
allowing Agent's write_file/read_file operations to work directly
on the E2B filesystem instead of LangGraph state.

This unifies the file system so that:
- Agent write_file -> E2B sandbox
- Python execute_python -> E2B sandbox
- User uploaded files -> synced to E2B sandbox

All files in one place, solving the split between Files (State) and File Panel.
"""

from typing import Any, Optional

from deepagents.backends.protocol import (
    ExecuteResponse,
    FileDownloadResponse,
    FileUploadResponse,
    WriteResult,
)
from deepagents.backends.sandbox import BaseSandbox


class E2BSandboxBackend(BaseSandbox):
    """
    E2B Sandbox Backend that implements SandboxBackendProtocol.

    This backend routes all file operations (write_file, read_file, edit_file, etc.)
    to the E2B sandbox, ensuring a unified filesystem for both Agent operations
    and Python code execution.

    Key features:
    - All file ops go to E2B sandbox (not LangGraph state)
    - Files persist in sandbox during session
    - Files are synced to Supabase Storage for long-term persistence
    - Compatible with existing E2BSandboxExecutor per-user sandbox management
    """

    def __init__(
        self,
        sandbox: Any,
        user_id: str,
        thread_id: Optional[str] = None,
        sync_to_storage: bool = True,
    ):
        """
        Initialize E2B Sandbox Backend.

        Args:
            sandbox: E2B Sandbox instance (from e2b_code_interpreter)
            user_id: User ID for file ownership and storage sync
            thread_id: Thread ID for file-thread association
            sync_to_storage: Whether to sync written files to Supabase Storage
        """
        self.sandbox = sandbox
        self.user_id = user_id
        self.thread_id = thread_id
        self.sync_to_storage = sync_to_storage
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        """Ensure /home/user/data directory exists"""
        try:
            self.sandbox.files.make_dir("/home/user/data")
        except Exception:
            pass  # Directory may already exist

    @property
    def id(self) -> str:
        """Unique identifier for the sandbox backend instance."""
        return self.sandbox.id if hasattr(self.sandbox, "id") else f"e2b-{self.user_id}"

    def execute(self, command: str) -> ExecuteResponse:
        """
        Execute a shell command in the E2B sandbox.

        This is used by BaseSandbox's default implementations of
        read, write, edit, ls, glob, grep operations.
        """
        try:
            # E2B code-interpreter uses sandbox.commands.run() for shell commands
            result = self.sandbox.commands.run(command)
            return ExecuteResponse(
                output=(result.stdout or "") + (result.stderr or ""),
                exit_code=result.exit_code,
                truncated=False,
            )
        except Exception as e:
            return ExecuteResponse(
                output=f"Error executing command: {str(e)}",
                exit_code=1,
                truncated=False,
            )

    def write(self, file_path: str, content: str) -> WriteResult:
        """
        Write a file to E2B sandbox and optionally sync to Supabase Storage.

        Overrides BaseSandbox.write() to add Supabase sync functionality.
        """
        # First, use parent implementation to write to sandbox
        result = super().write(file_path, content)

        if result.error:
            return result

        # Sync to Supabase Storage if enabled
        if self.sync_to_storage and result.path:
            self._sync_file_to_storage(result.path, content.encode("utf-8"))

        return result

    def _sync_file_to_storage(self, sandbox_path: str, content: bytes):
        """
        Sync a file from sandbox to Supabase Storage.

        This ensures files persist even after sandbox timeout.
        """
        try:
            from ..storage.file_storage import save_generated_file

            # Extract filename from path
            filename = sandbox_path.split("/")[-1]

            # Determine file type based on extension
            if filename.endswith((".png", ".jpg", ".jpeg", ".gif")):
                file_type = "chart"
            else:
                file_type = "generated"

            # Save to storage with thread association
            file_info = save_generated_file(
                filename=filename,
                data=content,
                user_id=self.user_id,
                thread_id=self.thread_id,
                file_type=file_type,
            )

            if file_info:
                print(
                    f"[E2BSandboxBackend] Synced {sandbox_path} to storage: {file_info.get('download_url', 'N/A')}"
                )

        except Exception as e:
            print(f"[E2BSandboxBackend] Warning: Failed to sync {sandbox_path} to storage: {e}")

    def upload_files(self, files: list[tuple[str, bytes]]) -> list[FileUploadResponse]:
        """
        Upload multiple files to the E2B sandbox.

        Args:
            files: List of (path, content) tuples

        Returns:
            List of FileUploadResponse objects
        """
        responses = []

        for path, content in files:
            try:
                # Ensure parent directory exists
                parent_dir = "/".join(path.split("/")[:-1])
                if parent_dir:
                    try:
                        self.sandbox.files.make_dir(parent_dir)
                    except Exception:
                        pass

                # Write file to sandbox
                self.sandbox.files.write(path, content)
                responses.append(FileUploadResponse(path=path, error=None))

                # Sync to storage if enabled
                if self.sync_to_storage:
                    self._sync_file_to_storage(path, content)

            except Exception as e:
                error_type = (
                    "permission_denied" if "permission" in str(e).lower() else "invalid_path"
                )
                responses.append(FileUploadResponse(path=path, error=error_type))

        return responses

    def download_files(self, paths: list[str]) -> list[FileDownloadResponse]:
        """
        Download multiple files from the E2B sandbox.

        Args:
            paths: List of file paths to download

        Returns:
            List of FileDownloadResponse objects
        """
        responses = []

        for path in paths:
            try:
                # Read file from sandbox
                content = self.sandbox.files.read(path, format="bytes")
                content_bytes = bytes(content) if not isinstance(content, bytes) else content
                responses.append(FileDownloadResponse(path=path, content=content_bytes, error=None))
            except FileNotFoundError:
                responses.append(
                    FileDownloadResponse(path=path, content=None, error="file_not_found")
                )
            except Exception as e:
                error_type = (
                    "permission_denied" if "permission" in str(e).lower() else "file_not_found"
                )
                responses.append(FileDownloadResponse(path=path, content=None, error=error_type))

        return responses


def get_e2b_backend_factory(executor: Any):
    """
    Create a backend factory function for use with create_deep_agent().

    This factory ensures that the backend uses the same sandbox instance
    as the execute_python tool, maintaining filesystem consistency.

    Args:
        executor: E2BSandboxExecutor instance

    Returns:
        A factory function that creates E2BSandboxBackend instances

    Usage:
        from deepagents import create_deep_agent
        from src.sandbox.executor import get_executor
        from src.sandbox.backend import get_e2b_backend_factory

        executor = get_executor()
        backend_factory = get_e2b_backend_factory(executor)

        graph = create_deep_agent(
            model=model,
            tools=tools,
            backend=backend_factory,
        )
    """
    from ..runtime_context import thread_id_ctx, user_id_ctx
    from .executor import AsyncE2BSandboxExecutor, E2BSandboxExecutor

    def backend_factory(runtime):
        """
        Factory function that creates E2BSandboxBackend for each agent invocation.

        Gets user_id and thread_id from ContextVar (set by middleware) and retrieves the appropriate sandbox.
        """
        # Get user_id from ContextVar (most reliable, set by FastAPI middleware)
        user_id = (user_id_ctx.get() or "").strip()
        thread_id = thread_id_ctx.get()

        # Fallback: try to get from runtime config if ContextVar not set
        if user_id in ("", "default") and hasattr(runtime, "config"):
            config = getattr(runtime, "config", {}) or {}
            if isinstance(config, dict):
                configurable = config.get("configurable", {})
                user_id = (configurable.get("user_id", user_id) or "").strip()
                if thread_id == "default":
                    thread_id = configurable.get("thread_id", thread_id)

        if user_id == "":
            # Normalize empty string to "default" to avoid creating a separate sandbox key.
            user_id = "default"

        # Normalize thread_id (treat "default" as None for DB)
        if thread_id == "default":
            thread_id = None

        print(f"[E2BSandboxBackend] Creating backend for user: {user_id}, thread: {thread_id}")

        # Get or create sandbox for this user
        # Support both sync (E2BSandboxExecutor) and async (AsyncE2BSandboxExecutor) executors
        if isinstance(executor, E2BSandboxExecutor):
            sandbox = executor._get_sandbox(user_id)
            return E2BSandboxBackend(
                sandbox=sandbox,
                user_id=user_id,
                thread_id=thread_id,
                sync_to_storage=True,
            )
        elif isinstance(executor, AsyncE2BSandboxExecutor):
            # Async sandbox backends require an async-native integration to avoid
            # event-loop lifecycle issues. For now we explicitly fall back to the
            # StateBackend when an async executor is selected.
            #
            # Use SANDBOX_MODE=e2b or SANDBOX_MODE=e2b-sync for stable, unified filesystem behavior.
            from deepagents.backends import StateBackend

            print(
                "[E2BSandboxBackend] Async executor selected; falling back to StateBackend. "
                "Set SANDBOX_MODE=e2b (sync) for stable E2B-backed file ops."
            )
            return StateBackend(runtime)
        else:
            # For non-E2B executors (local, docker), fall back to StateBackend
            from deepagents.backends import StateBackend

            print("[E2BSandboxBackend] Non-E2B executor, falling back to StateBackend")
            return StateBackend(runtime)

    return backend_factory
