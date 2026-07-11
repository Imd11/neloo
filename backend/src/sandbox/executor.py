"""
Sandbox Executor Module

Provides multiple sandbox execution backends:
- E2BSandboxExecutor: Cloud sandbox via E2B (recommended for production)
- LocalSubprocessExecutor: Local subprocess (development only, no isolation)
- DockerExecutor: Docker container (self-hosted, secure)

Usage:
    from src.sandbox import execute_python

    result = execute_python('''
    import pandas as pd
    df = pd.DataFrame({'a': [1, 2, 3]})
    print(df.describe())
    ''')
"""

import asyncio
import base64
import os
import subprocess
import sys
import tempfile
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

# Environment variables considered safe to pass to the local-subprocess sandbox.
# Everything else (API keys, secrets, tokens, database URLs) is stripped so that
# untrusted user code executed by LocalSubprocessExecutor cannot read host secrets.
_SAFE_CHILD_ENV_KEYS = frozenset(
    {
        "PATH",
        "HOME",
        "USER",
        "LOGNAME",
        "LANG",
        "LC_ALL",
        "LC_CTYPE",
        "TMPDIR",
        "TMP",
        "TEMP",
        "SYSTEMROOT",
        "APPDATA",
        "PATHEXT",
        "TZ",  # timezone — pandas/matplotlib date display depends on it
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "NO_PROXY",  # corporate egress proxies
        "SSL_CERT_FILE",  # enterprise CA bundles
    }
)


def _build_child_env() -> dict:
    """Build a minimal, secret-free environment for the local subprocess sandbox."""
    env = {k: v for k, v in os.environ.items() if k in _SAFE_CHILD_ENV_KEYS}
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return env


@dataclass
class ExecutionResult:
    """Result of code execution"""

    success: bool
    stdout: str = ""
    stderr: str = ""
    results: list[dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None
    generated_files: list[dict[str, Any]] = field(
        default_factory=list
    )  # New files created during execution

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "results": self.results,
            "error": self.error,
            "generated_files": self.generated_files,
        }


class SandboxExecutor(ABC):
    """Abstract base class for sandbox executors"""

    @abstractmethod
    def execute(
        self,
        code: str,
        timeout: int = 300,
        user_id: str = "default",
        thread_id: Optional[str] = None,
    ) -> ExecutionResult:
        """Execute Python code and return the result"""
        pass

    @abstractmethod
    def close(self) -> None:
        """Clean up resources"""
        pass


# =============================================================================
# E2B Cloud Sandbox Executor (Production) - Per-User Isolation
# =============================================================================


@dataclass
class SandboxInfo:
    """Information about a user's sandbox instance"""

    sandbox: Any  # E2B Sandbox instance
    last_used: datetime
    created_at: datetime
    is_executing: bool = False  # True while code is running, prevents LRU eviction


class E2BSandboxExecutor(SandboxExecutor):
    """
    E2B Cloud Sandbox Executor with Per-User Isolation

    Executes code in E2B's secure cloud sandbox environment.
    Each user gets their own isolated sandbox instance to prevent
    cross-user file access and data leakage.

    Features:
    - Per-user sandbox isolation (user_id -> sandbox mapping)
    - Per-user execution lock (prevents concurrent execution conflicts)
    - LRU eviction when max sandbox limit reached
    - Automatic idle sandbox cleanup
    - Pre-execution file sync guarantee

    Pre-installed packages: pandas, numpy, scipy, statsmodels, matplotlib

    Requires: E2B_API_KEY environment variable
    """

    # Configuration
    SANDBOX_TIMEOUT = 600  # E2B sandbox lifetime (10 minutes)
    IDLE_CLEANUP_THRESHOLD = 1800  # Cleanup sandboxes idle for 30 minutes
    MAX_SANDBOXES = 50  # Maximum concurrent sandboxes

    def __init__(self):
        """
        Initialize E2B executor with per-user sandbox management
        """
        self._sandboxes: dict[str, SandboxInfo] = {}  # user_id -> SandboxInfo
        self._lock = threading.Lock()  # Protects _sandboxes dict
        self._user_locks: dict[str, threading.Lock] = {}  # Per-user execution locks
        print(
            f"[E2BExecutor] Initialized with per-user isolation (max {self.MAX_SANDBOXES} sandboxes)"
        )

    def _get_user_lock(self, user_id: str) -> threading.Lock:
        """
        Get or create a per-user execution lock.

        This prevents concurrent code execution for the same user,
        which could cause file conflicts within a sandbox.
        """
        with self._lock:
            if user_id not in self._user_locks:
                self._user_locks[user_id] = threading.Lock()
            return self._user_locks[user_id]

    def _get_sandbox(self, user_id: str, force_new: bool = False):
        """
        Get or create a sandbox for a specific user.

        Each user gets their own isolated sandbox. Sandboxes are reused
        within their lifetime to enable file pre-warming.

        Args:
            user_id: User identifier (must come from trusted JWT)
            force_new: If True, always create a new sandbox (used after expiration)
        """
        with self._lock:
            now = datetime.now()

            # Check if user already has a sandbox
            if user_id in self._sandboxes and not force_new:
                info = self._sandboxes[user_id]
                # Check if sandbox is still valid (not expired)
                elapsed = (now - info.created_at).total_seconds()
                if elapsed < self.SANDBOX_TIMEOUT - 30:  # 30s buffer
                    info.last_used = now
                    print(f"[E2BExecutor] Reusing sandbox for user {user_id} (age: {elapsed:.0f}s)")
                    return info.sandbox
                else:
                    # Sandbox expired, close it
                    print(f"[E2BExecutor] Sandbox expired for user {user_id}, recreating")
                    self._close_sandbox_unlocked(user_id)

            # Check if we need to evict old sandboxes
            if len(self._sandboxes) >= self.MAX_SANDBOXES:
                self._evict_lru_sandbox_unlocked()

            # Create new sandbox for this user
            try:
                from e2b_code_interpreter import Sandbox

                # Use official code-interpreter template (default)
                sandbox = Sandbox.create(timeout=self.SANDBOX_TIMEOUT)
                self._sandboxes[user_id] = SandboxInfo(
                    sandbox=sandbox, last_used=now, created_at=now
                )
                print(
                    f"[E2BExecutor] Created new sandbox for user {user_id} (total: {len(self._sandboxes)})"
                )
                return sandbox
            except ImportError:
                raise ImportError(
                    "e2b-code-interpreter is required for E2B sandbox. "
                    "Install with: pip install e2b-code-interpreter"
                )
            except Exception as e:
                raise RuntimeError(f"Failed to create E2B sandbox: {e}")

    def _close_sandbox_unlocked(self, user_id: str):
        """Close sandbox for a user (must hold _lock)"""
        if user_id in self._sandboxes:
            try:
                # e2b_code_interpreter.Sandbox uses kill() to terminate a sandbox.
                # Using a non-existent close() caused resource leaks and prevented proper cleanup.
                self._sandboxes[user_id].sandbox.kill()
            except Exception as e:
                print(f"[E2BExecutor] Error closing sandbox for {user_id}: {e}")
            del self._sandboxes[user_id]

    def _evict_lru_sandbox_unlocked(self):
        """
        Evict the least recently used sandbox (must hold _lock).

        Skips sandboxes that are currently executing to prevent
        interrupting active code execution.
        """
        if not self._sandboxes:
            return

        # Find candidates that are NOT currently executing
        candidates = [user_id for user_id, info in self._sandboxes.items() if not info.is_executing]

        if not candidates:
            # All sandboxes are executing, cannot evict safely
            print(
                f"[E2BExecutor] WARNING: All {len(self._sandboxes)} sandboxes are executing, cannot evict"
            )
            return

        # Find the user with oldest last_used time among non-executing sandboxes
        oldest_user = min(candidates, key=lambda u: self._sandboxes[u].last_used)
        print(f"[E2BExecutor] Evicting LRU sandbox for user {oldest_user}")
        self._close_sandbox_unlocked(oldest_user)

    def cleanup_idle_sandboxes(self):
        """
        Clean up sandboxes and user locks that have been idle for too long.

        This can be called periodically by a background task to
        free up resources and reduce costs.

        Also cleans up orphaned user locks to prevent memory leaks.
        """
        with self._lock:
            now = datetime.now()
            to_remove = []

            # Find idle sandboxes (skip those currently executing)
            for user_id, info in self._sandboxes.items():
                if info.is_executing:
                    continue  # Don't cleanup executing sandboxes
                idle_seconds = (now - info.last_used).total_seconds()
                if idle_seconds > self.IDLE_CLEANUP_THRESHOLD:
                    to_remove.append(user_id)

            # Close idle sandboxes
            for user_id in to_remove:
                print(f"[E2BExecutor] Cleaning up idle sandbox for user {user_id}")
                self._close_sandbox_unlocked(user_id)

            if to_remove:
                print(f"[E2BExecutor] Cleaned up {len(to_remove)} idle sandboxes")

            # Clean up orphaned user locks (users without sandboxes)
            # A lock is orphaned if the user has no sandbox AND the lock is not currently held
            orphaned_locks = []
            for user_id in list(self._user_locks.keys()):
                if user_id not in self._sandboxes:
                    lock = self._user_locks[user_id]
                    # Try to acquire the lock non-blocking to check if it's free
                    if lock.acquire(blocking=False):
                        lock.release()
                        orphaned_locks.append(user_id)

            for user_id in orphaned_locks:
                del self._user_locks[user_id]

            if orphaned_locks:
                print(f"[E2BExecutor] Cleaned up {len(orphaned_locks)} orphaned user locks")

    def _ensure_files_synced(self, sandbox, user_id: str):
        """
        Ensure all user files are synced to sandbox before execution.

        This fallback sync guarantees files
        are present even if pre-warming failed or sandbox was recreated.
        """
        try:
            from .file_sync import (
                BUCKET_NAME,
                SUPABASE_SERVICE_KEY,
                SUPABASE_URL,
                USE_LOCAL_STORAGE,
                list_supabase_files,
                sync_file_to_e2b,
            )

            print("[E2BExecutor] ========== FILE SYNC DEBUG ==========")
            print(f"[E2BExecutor] user_id = '{user_id}' (type: {type(user_id).__name__})")
            print(f"[E2BExecutor] Storage mode: {'LOCAL' if USE_LOCAL_STORAGE else 'SUPABASE'}")
            print(f"[E2BExecutor] BUCKET_NAME = '{BUCKET_NAME}'")
            print(f"[E2BExecutor] SUPABASE_URL configured: {bool(SUPABASE_URL)}")
            print(f"[E2BExecutor] SUPABASE_SERVICE_KEY configured: {bool(SUPABASE_SERVICE_KEY)}")

            remote_files = list_supabase_files(user_id=user_id)
            print(f"[E2BExecutor] Found {len(remote_files)} files in storage for user {user_id}")

            # Ensure the data directory exists even when there are no files to sync.
            # This prevents downstream code that lists /home/user/data from failing.
            try:
                sandbox.files.make_dir("/home/user/data")
            except Exception:
                pass

            if remote_files:
                # Get list of files already in sandbox
                data_dir = "/home/user/data"
                try:
                    existing_files = {f.name for f in sandbox.files.list(data_dir)}
                except Exception:
                    existing_files = set()

                # Sync missing files
                synced_count = 0
                for file_info in remote_files:
                    storage_path = file_info.get("storage_path")
                    if storage_path:
                        # Extract filename from storage path
                        filename = (
                            storage_path.split("/")[-1] if "/" in storage_path else storage_path
                        )
                        if filename not in existing_files:
                            result = sync_file_to_e2b(sandbox, storage_path)
                            synced_count += 1
                            print(f"[E2BExecutor] Synced missing file: {storage_path} -> {result}")

                if synced_count > 0:
                    print(f"[E2BExecutor] Synced {synced_count} missing files")
                else:
                    print(f"[E2BExecutor] All {len(remote_files)} files already in sandbox")
            else:
                print(f"[E2BExecutor] No files to sync for user {user_id}")

        except Exception as e:
            import traceback

            print(f"[E2BExecutor] Warning: File sync check failed: {e}")
            print(f"[E2BExecutor] Traceback: {traceback.format_exc()}")

    def _set_executing(self, user_id: str, is_executing: bool):
        """Set the is_executing flag for a user's sandbox (thread-safe)"""
        with self._lock:
            if user_id in self._sandboxes:
                self._sandboxes[user_id].is_executing = is_executing

    def execute(
        self,
        code: str,
        timeout: int = 300,
        user_id: str = "default",
        thread_id: Optional[str] = None,
    ) -> ExecutionResult:
        """
        Execute code in user's isolated E2B sandbox.

        Uses per-user execution lock to prevent concurrent execution
        conflicts within the same sandbox.
        """
        # Get per-user lock to prevent concurrent execution
        user_lock = self._get_user_lock(user_id)

        with user_lock:
            max_retries = 2  # Retry once if sandbox expired

            for attempt in range(max_retries):
                try:
                    # Get user's sandbox (force new on retry)
                    sandbox = self._get_sandbox(user_id, force_new=(attempt > 0))

                    # Mark sandbox as executing to prevent LRU eviction
                    self._set_executing(user_id, True)

                    try:
                        # Ensure files are synced before execution.
                        self._ensure_files_synced(sandbox, user_id)

                        # Execute code
                        result = self._execute_in_sandbox(
                            sandbox, code, timeout, user_id, thread_id
                        )
                        return result
                    finally:
                        # Always clear executing flag when done
                        self._set_executing(user_id, False)

                except Exception as e:
                    error_str = str(e)
                    # Check if error is due to sandbox not found (expired)
                    if "sandbox was not found" in error_str or "502" in error_str:
                        if attempt < max_retries - 1:
                            print(
                                f"[E2BExecutor] Sandbox expired for user {user_id}, recreating (attempt {attempt + 2})"
                            )
                            # Clear the stale reference and best-effort kill the sandbox to avoid leaks.
                            with self._lock:
                                self._close_sandbox_unlocked(user_id)
                            continue  # Retry with new sandbox

                    # Other errors or final attempt failed
                    return ExecutionResult(
                        success=False,
                        error=f"E2B execution error: {error_str}",
                    )

            # Should not reach here
            return ExecutionResult(
                success=False,
                error="E2B execution failed after retries",
            )

    def _execute_in_sandbox(
        self,
        sandbox,
        code: str,
        timeout: int,
        user_id: str = "default",
        thread_id: Optional[str] = None,
    ) -> ExecutionResult:
        """
        Internal method to execute code in a given sandbox.

        Note: File sync is handled by _ensure_files_synced() before this method
        is called, so we don't need to sync again here.
        """
        try:
            # Make sure /home/user/data exists for user code and for generated file collection.
            try:
                sandbox.files.make_dir("/home/user/data")
            except Exception:
                pass

            print(f"[E2BExecutor] Executing code for user {user_id}")
            execution = sandbox.run_code(code, timeout=timeout)

            # Process results
            results = []
            generated_files = []

            if execution.results:
                for r in execution.results:
                    if hasattr(r, "png") and r.png:
                        results.append({"type": "image/png", "data": r.png})
                    elif hasattr(r, "html") and r.html:
                        results.append({"type": "text/html", "data": r.html})
                    elif hasattr(r, "text") and r.text:
                        results.append({"type": "text/plain", "data": r.text})
                    elif hasattr(r, "latex") and r.latex:
                        results.append({"type": "text/latex", "data": r.latex})

            # Sync generated files from E2B sandbox back to storage
            try:
                from ..storage.file_storage import save_generated_file

                # List files in /home/user/data/
                data_dir = "/home/user/data"
                try:
                    files_in_sandbox = sandbox.files.list(data_dir)
                    print(
                        f"[E2BExecutor] Files in sandbox data dir: {[f.name for f in files_in_sandbox]}"
                    )
                except Exception as e:
                    print(f"[E2BExecutor] Could not list sandbox files: {e}")
                    files_in_sandbox = []

                # Process all generated files
                for f in files_in_sandbox:
                    file_path = f"{data_dir}/{f.name}"

                    # Handle image files (PNG) - add to results for inline display
                    if f.name.endswith(".png"):
                        try:
                            # Read the file content from sandbox as bytes
                            content = sandbox.files.read(file_path, format="bytes")
                            content_bytes = bytes(content)
                            img_base64 = base64.b64encode(content_bytes).decode("utf-8")
                            results.append({"type": "image/png", "data": img_base64})
                            print(f"[E2BExecutor] Read image from sandbox: {file_path}")

                            # Also save to persistent storage for download
                            # Use file_type="chart" for images/charts
                            file_info = save_generated_file(
                                filename=f.name,
                                data=content_bytes,
                                user_id=user_id,
                                thread_id=thread_id,
                                file_type="chart",  # Charts and images
                            )
                            if file_info:
                                generated_files.append(
                                    {
                                        "filename": f.name,
                                        "sandbox_path": file_path,
                                        "size": len(content_bytes),
                                        "download_url": file_info["download_url"],
                                        "file_id": file_info["file_id"],
                                        "content_type": "image/png",
                                        "file_type": "chart",
                                    }
                                )
                                print(
                                    f"[E2BExecutor] Saved chart to storage: {file_info['download_url']}"
                                )
                            else:
                                generated_files.append(
                                    {
                                        "filename": f.name,
                                        "sandbox_path": file_path,
                                        "size": len(content_bytes),
                                        "file_type": "chart",
                                    }
                                )
                        except Exception as e:
                            print(f"[E2BExecutor] Failed to read image {f.name}: {e}")

                    # Handle other file types (CSV, Excel, TXT, etc.) - save to storage for download
                    elif f.name.endswith(
                        (".csv", ".xlsx", ".xls", ".json", ".txt", ".pdf", ".html", ".md")
                    ):
                        try:
                            # Determine read format based on file type
                            if f.name.endswith((".xlsx", ".xls", ".pdf")):
                                content = sandbox.files.read(file_path, format="bytes")
                                content_bytes = bytes(content)
                            else:
                                # Text-based files
                                content = sandbox.files.read(file_path)
                                content_bytes = (
                                    content.encode("utf-8")
                                    if isinstance(content, str)
                                    else bytes(content)
                                )

                            # Save to persistent storage with file_type="generated" for data files
                            file_info = save_generated_file(
                                filename=f.name,
                                data=content_bytes,
                                user_id=user_id,
                                thread_id=thread_id,
                                file_type="generated",  # Generated data files
                            )

                            if file_info:
                                generated_files.append(
                                    {
                                        "filename": f.name,
                                        "sandbox_path": file_path,
                                        "size": len(content_bytes),
                                        "download_url": file_info["download_url"],
                                        "file_id": file_info["file_id"],
                                        "content_type": file_info["content_type"],
                                        "file_type": "generated",
                                    }
                                )
                                print(
                                    f"[E2BExecutor] Saved file to storage: {f.name} -> {file_info['download_url']}"
                                )
                            else:
                                generated_files.append(
                                    {
                                        "filename": f.name,
                                        "sandbox_path": file_path,
                                        "size": len(content_bytes),
                                        "file_type": "generated",
                                    }
                                )
                                print(f"[E2BExecutor] Found generated file (not saved): {f.name}")

                        except Exception as e:
                            print(f"[E2BExecutor] Failed to read/save file {f.name}: {e}")
                            generated_files.append(
                                {
                                    "filename": f.name,
                                    "sandbox_path": file_path,
                                }
                            )

            except Exception as e:
                import traceback

                print(f"[E2BExecutor] Warning: Failed to sync generated files: {e}")
                print(f"[E2BExecutor] Traceback: {traceback.format_exc()}")

            return ExecutionResult(
                success=execution.error is None,
                stdout=execution.logs.stdout if execution.logs else "",
                stderr=execution.logs.stderr if execution.logs else "",
                results=results,
                error=str(execution.error) if execution.error else None,
                generated_files=generated_files,
            )

        except Exception:
            # Re-raise to let execute() handle retry logic
            raise

    def close(self) -> None:
        """Close all user sandboxes"""
        with self._lock:
            for user_id in list(self._sandboxes.keys()):
                self._close_sandbox_unlocked(user_id)
            self._sandboxes.clear()
            self._user_locks.clear()
            print("[E2BExecutor] Closed all sandboxes")


# =============================================================================
# Async E2B Cloud Sandbox Executor (Production) - Per-User Isolation
# =============================================================================


class AsyncE2BSandboxExecutor(SandboxExecutor):
    """
    Async E2B Cloud Sandbox Executor with Per-User Isolation

    Uses AsyncSandbox and asyncio.Lock to enable true parallel SubAgent execution.
    This executor does NOT block the asyncio event loop, allowing multiple SubAgents
    to execute code concurrently.

    Features:
    - Per-user sandbox isolation (user_id -> sandbox mapping)
    - Per-user asyncio.Lock (allows event loop to schedule other tasks)
    - LRU eviction when max sandbox limit reached
    - Automatic idle sandbox cleanup
    - Pre-execution file sync guarantee

    Pre-installed packages: pandas, numpy, scipy, statsmodels, matplotlib

    Requires: E2B_API_KEY environment variable
    """

    # Configuration
    SANDBOX_TIMEOUT = 600  # E2B sandbox lifetime (10 minutes)
    IDLE_CLEANUP_THRESHOLD = 1800  # Cleanup sandboxes idle for 30 minutes
    MAX_SANDBOXES = 50  # Maximum concurrent sandboxes

    def __init__(self):
        """
        Initialize Async E2B executor with per-user sandbox management
        """
        self._sandboxes: dict[str, SandboxInfo] = {}  # user_id -> SandboxInfo
        self._lock = asyncio.Lock()  # Protects _sandboxes dict (async)
        self._user_locks: dict[str, asyncio.Lock] = {}  # Per-user execution locks (async)
        print(
            f"[AsyncE2BExecutor] Initialized with per-user isolation (max {self.MAX_SANDBOXES} sandboxes)"
        )

    async def _get_user_lock(self, user_id: str) -> asyncio.Lock:
        """
        Get or create a per-user execution lock (async).

        This prevents concurrent code execution for the same user,
        which could cause file conflicts within a sandbox.
        Uses asyncio.Lock to allow event loop scheduling during wait.
        """
        async with self._lock:
            if user_id not in self._user_locks:
                self._user_locks[user_id] = asyncio.Lock()
            return self._user_locks[user_id]

    async def _get_sandbox(self, user_id: str, force_new: bool = False):
        """
        Get or create a sandbox for a specific user (async).

        Each user gets their own isolated sandbox. Sandboxes are reused
        within their lifetime to enable file pre-warming.

        Args:
            user_id: User identifier (must come from trusted JWT)
            force_new: If True, always create a new sandbox (used after expiration)
        """
        async with self._lock:
            now = datetime.now()

            # Check if user already has a sandbox
            if user_id in self._sandboxes and not force_new:
                info = self._sandboxes[user_id]
                # Check if sandbox is still valid (not expired)
                elapsed = (now - info.created_at).total_seconds()
                if elapsed < self.SANDBOX_TIMEOUT - 30:  # 30s buffer
                    info.last_used = now
                    print(
                        f"[AsyncE2BExecutor] Reusing sandbox for user {user_id} (age: {elapsed:.0f}s)"
                    )
                    return info.sandbox
                else:
                    # Sandbox expired, close it
                    print(f"[AsyncE2BExecutor] Sandbox expired for user {user_id}, recreating")
                    await self._close_sandbox_unlocked(user_id)

            # Check if we need to evict old sandboxes
            if len(self._sandboxes) >= self.MAX_SANDBOXES:
                await self._evict_lru_sandbox_unlocked()

            # Create new sandbox for this user
            try:
                from e2b_code_interpreter import AsyncSandbox

                # Use official code-interpreter template (default)
                sandbox = await AsyncSandbox.create(timeout=self.SANDBOX_TIMEOUT)
                self._sandboxes[user_id] = SandboxInfo(
                    sandbox=sandbox, last_used=now, created_at=now
                )
                print(
                    f"[AsyncE2BExecutor] Created new sandbox for user {user_id} (total: {len(self._sandboxes)})"
                )
                return sandbox
            except ImportError:
                raise ImportError(
                    "e2b-code-interpreter is required for E2B sandbox. "
                    "Install with: pip install e2b-code-interpreter"
                )
            except Exception as e:
                raise RuntimeError(f"Failed to create E2B sandbox: {e}")

    async def _close_sandbox_unlocked(self, user_id: str):
        """Close sandbox for a user (must hold _lock)"""
        if user_id in self._sandboxes:
            try:
                # AsyncSandbox uses kill() to terminate
                await self._sandboxes[user_id].sandbox.kill()
            except Exception as e:
                print(f"[AsyncE2BExecutor] Error closing sandbox for {user_id}: {e}")
            del self._sandboxes[user_id]

    async def _evict_lru_sandbox_unlocked(self):
        """
        Evict the least recently used sandbox (must hold _lock).

        Skips sandboxes that are currently executing to prevent
        interrupting active code execution.
        """
        if not self._sandboxes:
            return

        # Find candidates that are NOT currently executing
        candidates = [user_id for user_id, info in self._sandboxes.items() if not info.is_executing]

        if not candidates:
            # All sandboxes are executing, cannot evict safely
            print(
                f"[AsyncE2BExecutor] WARNING: All {len(self._sandboxes)} sandboxes are executing, cannot evict"
            )
            return

        # Find the user with oldest last_used time among non-executing sandboxes
        oldest_user = min(candidates, key=lambda u: self._sandboxes[u].last_used)
        print(f"[AsyncE2BExecutor] Evicting LRU sandbox for user {oldest_user}")
        await self._close_sandbox_unlocked(oldest_user)

    async def cleanup_idle_sandboxes(self):
        """
        Clean up sandboxes and user locks that have been idle for too long (async).

        This can be called periodically by a background task to
        free up resources and reduce costs.
        """
        async with self._lock:
            now = datetime.now()
            to_remove = []

            # Find idle sandboxes (skip those currently executing)
            for user_id, info in self._sandboxes.items():
                if info.is_executing:
                    continue  # Don't cleanup executing sandboxes
                idle_seconds = (now - info.last_used).total_seconds()
                if idle_seconds > self.IDLE_CLEANUP_THRESHOLD:
                    to_remove.append(user_id)

            # Close idle sandboxes
            for user_id in to_remove:
                print(f"[AsyncE2BExecutor] Cleaning up idle sandbox for user {user_id}")
                await self._close_sandbox_unlocked(user_id)

            if to_remove:
                print(f"[AsyncE2BExecutor] Cleaned up {len(to_remove)} idle sandboxes")

            # Clean up orphaned user locks (users without sandboxes)
            orphaned_locks = [
                user_id
                for user_id in self._user_locks.keys()
                if user_id not in self._sandboxes and not self._user_locks[user_id].locked()
            ]

            for user_id in orphaned_locks:
                del self._user_locks[user_id]

            if orphaned_locks:
                print(f"[AsyncE2BExecutor] Cleaned up {len(orphaned_locks)} orphaned user locks")

    async def _ensure_files_synced(self, sandbox, user_id: str):
        """
        Ensure all user files are synced to sandbox before execution (async).

        This fallback sync guarantees files
        are present even if pre-warming failed or sandbox was recreated.
        """
        try:
            from .file_sync import (
                BUCKET_NAME,
                SUPABASE_SERVICE_KEY,
                SUPABASE_URL,
                USE_LOCAL_STORAGE,
                list_supabase_files,
            )

            print("[AsyncE2BExecutor] ========== FILE SYNC DEBUG ==========")
            print(f"[AsyncE2BExecutor] user_id = '{user_id}' (type: {type(user_id).__name__})")
            print(
                f"[AsyncE2BExecutor] Storage mode: {'LOCAL' if USE_LOCAL_STORAGE else 'SUPABASE'}"
            )
            print(f"[AsyncE2BExecutor] BUCKET_NAME = '{BUCKET_NAME}'")
            print(f"[AsyncE2BExecutor] SUPABASE_URL configured: {bool(SUPABASE_URL)}")
            print(
                f"[AsyncE2BExecutor] SUPABASE_SERVICE_KEY configured: {bool(SUPABASE_SERVICE_KEY)}"
            )

            remote_files = list_supabase_files(user_id=user_id)
            print(
                f"[AsyncE2BExecutor] Found {len(remote_files)} files in storage for user {user_id}"
            )

            # Ensure the data directory exists even when there are no files to sync.
            try:
                await sandbox.files.make_dir("/home/user/data")
            except Exception:
                pass

            if remote_files:
                # Get list of files already in sandbox
                data_dir = "/home/user/data"
                try:
                    existing_entries = await sandbox.files.list(data_dir)
                    existing_files = {f.name for f in existing_entries}
                except Exception:
                    existing_files = set()

                # Sync missing files (using async file operations)
                synced_count = 0
                for file_info in remote_files:
                    storage_path = file_info.get("storage_path")
                    if storage_path:
                        # Extract filename from storage path
                        filename = (
                            storage_path.split("/")[-1] if "/" in storage_path else storage_path
                        )
                        if filename not in existing_files:
                            # Use async sync function
                            result = await self._async_sync_file_to_e2b(sandbox, storage_path)
                            synced_count += 1
                            print(
                                f"[AsyncE2BExecutor] Synced missing file: {storage_path} -> {result}"
                            )

                if synced_count > 0:
                    print(f"[AsyncE2BExecutor] Synced {synced_count} missing files")
                else:
                    print(f"[AsyncE2BExecutor] All {len(remote_files)} files already in sandbox")
            else:
                print(f"[AsyncE2BExecutor] No files to sync for user {user_id}")

        except Exception as e:
            import traceback

            print(f"[AsyncE2BExecutor] Warning: File sync check failed: {e}")
            print(f"[AsyncE2BExecutor] Traceback: {traceback.format_exc()}")

    async def _async_sync_file_to_e2b(self, sandbox, storage_path: str) -> str:
        """
        Async version of sync_file_to_e2b.
        Downloads file from Supabase and uploads to E2B sandbox.
        """
        import httpx

        from .file_sync import BUCKET_NAME, SUPABASE_SERVICE_KEY, SUPABASE_URL, USE_LOCAL_STORAGE

        filename = storage_path.split("/")[-1] if "/" in storage_path else storage_path
        e2b_path = f"/home/user/data/{filename}"

        if USE_LOCAL_STORAGE:
            # For local storage, read file directly
            from .file_sync import get_local_data_dir

            local_path = get_local_data_dir() / storage_path.split("/")[-1]
            if local_path.exists():
                content = local_path.read_bytes()
                await sandbox.files.write(e2b_path, content)
                return e2b_path
            return f"File not found: {local_path}"

        # Download from Supabase using async httpx
        url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{storage_path}"
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                await sandbox.files.write(e2b_path, response.content)
                return e2b_path
            else:
                return f"Download failed: {response.status_code}"

    async def _set_executing(self, user_id: str, is_executing: bool):
        """Set the is_executing flag for a user's sandbox (async thread-safe)"""
        async with self._lock:
            if user_id in self._sandboxes:
                self._sandboxes[user_id].is_executing = is_executing

    def execute(
        self,
        code: str,
        timeout: int = 300,
        user_id: str = "default",
        thread_id: Optional[str] = None,
    ) -> ExecutionResult:
        """
        Synchronous wrapper for async execute.
        This is required by the SandboxExecutor interface.
        """
        # Run the async version in the event loop
        try:
            asyncio.get_running_loop()
            # If we're already in an async context, we need to use a different approach
            # This shouldn't happen in normal usage as tools are called via ainvoke
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(
                    asyncio.run, self.aexecute(code, timeout, user_id, thread_id)
                )
                return future.result()
        except RuntimeError:
            # No running event loop, safe to use asyncio.run
            return asyncio.run(self.aexecute(code, timeout, user_id, thread_id))

    async def aexecute(
        self,
        code: str,
        timeout: int = 300,
        user_id: str = "default",
        thread_id: Optional[str] = None,
    ) -> ExecutionResult:
        """
        Execute code in user's isolated E2B sandbox (async).

        Uses per-user asyncio.Lock to prevent concurrent execution
        conflicts within the same sandbox, while allowing the event
        loop to schedule other tasks (enabling true parallel SubAgent execution).
        """
        # Get per-user lock to prevent concurrent execution
        user_lock = await self._get_user_lock(user_id)

        async with user_lock:  # asyncio.Lock allows other coroutines to run
            max_retries = 2  # Retry once if sandbox expired

            for attempt in range(max_retries):
                try:
                    # Get user's sandbox (force new on retry)
                    sandbox = await self._get_sandbox(user_id, force_new=(attempt > 0))

                    # Mark sandbox as executing to prevent LRU eviction
                    await self._set_executing(user_id, True)

                    try:
                        # Ensure files are synced before execution.
                        await self._ensure_files_synced(sandbox, user_id)

                        # Execute code
                        result = await self._execute_in_sandbox(
                            sandbox, code, timeout, user_id, thread_id
                        )
                        return result
                    finally:
                        # Always clear executing flag when done
                        await self._set_executing(user_id, False)

                except Exception as e:
                    error_str = str(e)
                    # Check if error is due to sandbox not found (expired)
                    if "sandbox was not found" in error_str or "502" in error_str:
                        if attempt < max_retries - 1:
                            print(
                                f"[AsyncE2BExecutor] Sandbox expired for user {user_id}, recreating (attempt {attempt + 2})"
                            )
                            # Clear the stale reference
                            async with self._lock:
                                await self._close_sandbox_unlocked(user_id)
                            continue  # Retry with new sandbox

                    # Other errors or final attempt failed
                    return ExecutionResult(
                        success=False,
                        error=f"E2B execution error: {error_str}",
                    )

            # Should not reach here
            return ExecutionResult(
                success=False,
                error="E2B execution failed after retries",
            )

    async def _execute_in_sandbox(
        self,
        sandbox,
        code: str,
        timeout: int,
        user_id: str = "default",
        thread_id: Optional[str] = None,
    ) -> ExecutionResult:
        """
        Internal method to execute code in a given sandbox (async).
        """
        try:
            # Make sure /home/user/data exists
            try:
                await sandbox.files.make_dir("/home/user/data")
            except Exception:
                pass

            print(f"[AsyncE2BExecutor] Executing code for user {user_id}")
            execution = await sandbox.run_code(code, timeout=timeout)

            # Process results
            results = []
            generated_files = []

            if execution.results:
                for r in execution.results:
                    if hasattr(r, "png") and r.png:
                        results.append({"type": "image/png", "data": r.png})
                    elif hasattr(r, "html") and r.html:
                        results.append({"type": "text/html", "data": r.html})
                    elif hasattr(r, "text") and r.text:
                        results.append({"type": "text/plain", "data": r.text})
                    elif hasattr(r, "latex") and r.latex:
                        results.append({"type": "text/latex", "data": r.latex})

            # Sync generated files from E2B sandbox back to storage
            try:
                from ..storage.file_storage import save_generated_file

                # List files in /home/user/data/
                data_dir = "/home/user/data"
                try:
                    files_in_sandbox = await sandbox.files.list(data_dir)
                    print(
                        f"[AsyncE2BExecutor] Files in sandbox data dir: {[f.name for f in files_in_sandbox]}"
                    )
                except Exception as e:
                    print(f"[AsyncE2BExecutor] Could not list sandbox files: {e}")
                    files_in_sandbox = []

                # Process all generated files
                for f in files_in_sandbox:
                    file_path = f"{data_dir}/{f.name}"

                    # Handle image files (PNG)
                    if f.name.endswith(".png"):
                        try:
                            content = await sandbox.files.read(file_path, format="bytes")
                            content_bytes = bytes(content)
                            img_base64 = base64.b64encode(content_bytes).decode("utf-8")
                            results.append({"type": "image/png", "data": img_base64})
                            print(f"[AsyncE2BExecutor] Read image from sandbox: {file_path}")

                            file_info = save_generated_file(
                                filename=f.name,
                                data=content_bytes,
                                user_id=user_id,
                                thread_id=thread_id,
                                file_type="chart",
                            )
                            if file_info:
                                generated_files.append(
                                    {
                                        "filename": f.name,
                                        "sandbox_path": file_path,
                                        "size": len(content_bytes),
                                        "download_url": file_info["download_url"],
                                        "file_id": file_info["file_id"],
                                        "content_type": "image/png",
                                        "file_type": "chart",
                                    }
                                )
                                print(
                                    f"[AsyncE2BExecutor] Saved chart to storage: {file_info['download_url']}"
                                )
                            else:
                                generated_files.append(
                                    {
                                        "filename": f.name,
                                        "sandbox_path": file_path,
                                        "size": len(content_bytes),
                                        "file_type": "chart",
                                    }
                                )
                        except Exception as e:
                            print(f"[AsyncE2BExecutor] Failed to read image {f.name}: {e}")

                    # Handle other file types
                    elif f.name.endswith(
                        (".csv", ".xlsx", ".xls", ".json", ".txt", ".pdf", ".html", ".md")
                    ):
                        try:
                            if f.name.endswith((".xlsx", ".xls", ".pdf")):
                                content = await sandbox.files.read(file_path, format="bytes")
                                content_bytes = bytes(content)
                            else:
                                content = await sandbox.files.read(file_path)
                                content_bytes = (
                                    content.encode("utf-8")
                                    if isinstance(content, str)
                                    else bytes(content)
                                )

                            file_info = save_generated_file(
                                filename=f.name,
                                data=content_bytes,
                                user_id=user_id,
                                thread_id=thread_id,
                                file_type="generated",
                            )

                            if file_info:
                                generated_files.append(
                                    {
                                        "filename": f.name,
                                        "sandbox_path": file_path,
                                        "size": len(content_bytes),
                                        "download_url": file_info["download_url"],
                                        "file_id": file_info["file_id"],
                                        "content_type": file_info["content_type"],
                                        "file_type": "generated",
                                    }
                                )
                                print(
                                    f"[AsyncE2BExecutor] Saved file to storage: {f.name} -> {file_info['download_url']}"
                                )
                            else:
                                generated_files.append(
                                    {
                                        "filename": f.name,
                                        "sandbox_path": file_path,
                                        "size": len(content_bytes),
                                        "file_type": "generated",
                                    }
                                )

                        except Exception as e:
                            print(f"[AsyncE2BExecutor] Failed to read/save file {f.name}: {e}")
                            generated_files.append(
                                {
                                    "filename": f.name,
                                    "sandbox_path": file_path,
                                }
                            )

            except Exception as e:
                import traceback

                print(f"[AsyncE2BExecutor] Warning: Failed to sync generated files: {e}")
                print(f"[AsyncE2BExecutor] Traceback: {traceback.format_exc()}")

            return ExecutionResult(
                success=execution.error is None,
                stdout=execution.logs.stdout if execution.logs else "",
                stderr=execution.logs.stderr if execution.logs else "",
                results=results,
                error=str(execution.error) if execution.error else None,
                generated_files=generated_files,
            )

        except Exception:
            # Re-raise to let aexecute() handle retry logic
            raise

    def close(self) -> None:
        """Close all user sandboxes (sync wrapper)"""
        try:
            asyncio.get_running_loop()
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, self.aclose())
                future.result()
        except RuntimeError:
            asyncio.run(self.aclose())

    async def aclose(self) -> None:
        """Close all user sandboxes (async)"""
        async with self._lock:
            for user_id in list(self._sandboxes.keys()):
                await self._close_sandbox_unlocked(user_id)
            self._sandboxes.clear()
            self._user_locks.clear()
            print("[AsyncE2BExecutor] Closed all sandboxes")


# =============================================================================
# Local Subprocess Executor (Development Only)
# =============================================================================


class LocalSubprocessExecutor(SandboxExecutor):
    """
    Local Subprocess Executor

    WARNING: This executor has NO SECURITY ISOLATION.
    Only use for local development and testing.

    Executes code directly on the host machine via subprocess.
    Supports capturing matplotlib figures as base64 images.
    """

    def __init__(self):
        print("[WARNING] LocalSubprocessExecutor has NO security isolation!")
        print("[WARNING] Only use for local development and testing.")
        self._data_dirs: dict[str, str] = {}

    def _get_data_dir(self, user_id: str) -> str:
        """Get or create the local data directory for file storage."""
        if user_id not in self._data_dirs:
            from .file_sync import get_local_data_dir

            self._data_dirs[user_id] = str(get_local_data_dir(user_id))
        return self._data_dirs[user_id]

    def _rewrite_paths(self, code: str, user_id: str) -> str:
        """
        Rewrite /home/user/data/ paths to actual local data directory.

        This allows code written for E2B sandbox to work in local mode.
        """
        local_data_dir = self._get_data_dir(user_id)
        # Replace the sandbox path with local path
        return code.replace("/home/user/data/", f"{local_data_dir}/")

    def _get_data_dir_snapshot(self, user_id: str) -> dict[str, float]:
        """
        Get a snapshot of files in data directory with their modification times.

        Returns:
            Dict mapping filename to modification time
        """
        data_dir = self._get_data_dir(user_id)
        snapshot = {}
        try:
            for item in os.listdir(data_dir):
                item_path = os.path.join(data_dir, item)
                if os.path.isfile(item_path):
                    snapshot[item] = os.path.getmtime(item_path)
        except Exception:
            pass
        return snapshot

    def _detect_new_files(
        self,
        before: dict[str, float],
        after: dict[str, float],
        user_id: str,
    ) -> list[dict[str, Any]]:
        """
        Detect new or modified files by comparing snapshots.

        Args:
            before: Snapshot before execution
            after: Snapshot after execution

        Returns:
            List of file info dicts with filename, size, and sandbox_path
        """
        data_dir = self._get_data_dir(user_id)
        new_files = []

        for filename, mtime in after.items():
            # Check if file is new or modified
            if filename not in before or mtime > before[filename]:
                file_path = os.path.join(data_dir, filename)
                try:
                    size = os.path.getsize(file_path)
                    new_files.append(
                        {
                            "filename": filename,
                            "size": size,
                            "sandbox_path": f"/home/user/data/{filename}",
                            "local_path": file_path,
                        }
                    )
                except Exception:
                    pass

        return new_files

    def execute(
        self,
        code: str,
        timeout: int = 300,
        user_id: str = "default",
        thread_id: Optional[str] = None,
    ) -> ExecutionResult:
        """Execute code locally via subprocess with image capture support"""
        # Security gate: LocalSubprocessExecutor runs user code directly on the
        # host with no isolation. Require explicit opt-in so a public deployment
        # that happens to set SANDBOX_MODE=local doesn't run untrusted code on
        # the server. Checked at execute() (not construction) so module import
        # and graph build never crash on this policy.
        opt_in = os.environ.get("ALLOW_LOCAL_SANDBOX", "false").lower() == "true"
        if not opt_in:
            raise RuntimeError(
                "SANDBOX_MODE=local runs code on the host with no isolation. "
                "Set ALLOW_LOCAL_SANDBOX=true to acknowledge local-dev-only use, "
                "or use SANDBOX_MODE=e2b for shared/public deployments."
            )

        # Auto-sync Supabase files to local before execution
        # This ensures all user-uploaded files are available in the local sandbox
        try:
            from .file_sync import sync_all_supabase_files_to_local

            synced_files = sync_all_supabase_files_to_local(user_id=user_id)
            if synced_files:
                print(f"[LocalExecutor] {len(synced_files)} files available for user {user_id}")
        except Exception as e:
            print(f"[LocalExecutor] Warning: Failed to sync files from storage: {e}")

        # Take snapshot of data directory before execution
        files_before = self._get_data_dir_snapshot(user_id)

        # Rewrite /home/user/data/ paths to local data directory
        code = self._rewrite_paths(code, user_id)

        # Create a temp directory for this execution
        temp_dir = tempfile.mkdtemp(prefix="sandbox_")
        temp_script = os.path.join(temp_dir, "script.py")
        temp_images_dir = os.path.join(temp_dir, "images")
        os.makedirs(temp_images_dir, exist_ok=True)

        # Wrapper code to capture matplotlib figures
        wrapper_code = f"""
import sys
import os
import warnings
warnings.filterwarnings('ignore')

# Set up matplotlib to save figures instead of displaying
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# Directory to save images
_IMAGE_DIR = {repr(temp_images_dir)}
_IMAGE_COUNT = [0]

# Override plt.show() to save figures
_original_show = plt.show
def _custom_show(*args, **kwargs):
    fig = plt.gcf()
    if fig.get_axes():  # Only save if figure has content
        _IMAGE_COUNT[0] += 1
        filepath = os.path.join(_IMAGE_DIR, f"figure_{{_IMAGE_COUNT[0]:03d}}.png")
        fig.savefig(filepath, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)

plt.show = _custom_show

# Also capture figures created with fig.savefig by tracking them
_original_savefig = plt.Figure.savefig
def _custom_savefig(self, fname, *args, **kwargs):
    # If saving to a simple filename, redirect to our temp dir
    if isinstance(fname, str) and not os.path.isabs(fname):
        _IMAGE_COUNT[0] += 1
        fname = os.path.join(_IMAGE_DIR, f"figure_{{_IMAGE_COUNT[0]:03d}}.png")
    return _original_savefig(self, fname, *args, **kwargs)

plt.Figure.savefig = _custom_savefig

# Execute user code
{code}

# Auto-save any remaining figures
for fig_num in plt.get_fignums():
    fig = plt.figure(fig_num)
    if fig.get_axes():
        _IMAGE_COUNT[0] += 1
        filepath = os.path.join(_IMAGE_DIR, f"figure_{{_IMAGE_COUNT[0]:03d}}.png")
        fig.savefig(filepath, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)
"""

        # Write the wrapper script
        with open(temp_script, "w", encoding="utf-8") as f:
            f.write(wrapper_code)

        try:
            result = subprocess.run(
                [sys.executable, temp_script],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=temp_dir,
                env=_build_child_env(),
            )

            results = []

            # Capture text output
            if result.stdout:
                results.append({"type": "text/plain", "data": result.stdout})

            # Capture generated images
            if os.path.exists(temp_images_dir):
                image_files = sorted([f for f in os.listdir(temp_images_dir) if f.endswith(".png")])
                for img_file in image_files:
                    img_path = os.path.join(temp_images_dir, img_file)
                    try:
                        with open(img_path, "rb") as f:
                            img_data = base64.b64encode(f.read()).decode("utf-8")
                            results.append({"type": "image/png", "data": img_data})
                    except Exception:
                        pass

            # Detect new files created during execution
            files_after = self._get_data_dir_snapshot(user_id)
            generated_files = self._detect_new_files(files_before, files_after, user_id)
            if generated_files:
                print(f"[LocalExecutor] Detected {len(generated_files)} new/modified files")

            return ExecutionResult(
                success=result.returncode == 0,
                stdout=result.stdout,
                stderr=result.stderr,
                results=results,
                error=result.stderr if result.returncode != 0 else None,
                generated_files=generated_files,
            )

        except subprocess.TimeoutExpired:
            return ExecutionResult(
                success=False,
                error=f"Execution timeout ({timeout}s)",
            )
        except Exception as e:
            return ExecutionResult(
                success=False,
                error=f"Local execution error: {str(e)}",
            )
        finally:
            # Clean up temp directory
            try:
                import shutil

                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass

    def close(self) -> None:
        """No resources to clean up"""
        pass


# =============================================================================
# Docker Container Executor (Self-hosted)
# =============================================================================


class DockerExecutor(SandboxExecutor):
    """
    Docker Container Executor

    Executes code in isolated Docker containers.
    Provides security isolation for self-hosted deployments.

    Requires: Docker installed and running
    """

    def __init__(self, image: str = "python:3.11-slim"):
        """
        Initialize Docker executor

        Args:
            image: Docker image to use for execution
        """
        self.image = image
        self._check_docker()

    def _check_docker(self) -> None:
        """Check if Docker is available"""
        try:
            result = subprocess.run(
                ["docker", "--version"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode != 0:
                raise RuntimeError("Docker is not available")
        except FileNotFoundError:
            raise RuntimeError(
                "Docker is not installed. Please install Docker or use a different sandbox mode."
            )

    def execute(
        self,
        code: str,
        timeout: int = 300,
        user_id: str = "default",
        thread_id: Optional[str] = None,
    ) -> ExecutionResult:
        """Execute code in Docker container"""
        # Note: user_id and thread_id are not used in Docker mode yet
        # Base64 encode to avoid shell escaping issues
        code_b64 = base64.b64encode(code.encode("utf-8")).decode("utf-8")

        # Build Docker command with security restrictions
        cmd = [
            "docker",
            "run",
            "--rm",
            "--network",
            "none",  # Disable network
            "--memory",
            "512m",  # Memory limit
            "--cpus",
            "1",  # CPU limit
            "--pids-limit",
            "50",  # Process limit
            "--read-only",  # Read-only filesystem
            "--tmpfs",
            "/tmp:rw,noexec,nosuid,size=100m",  # Writable /tmp
            self.image,
            "python",
            "-c",
            f"import base64; exec(base64.b64decode('{code_b64}').decode('utf-8'))",
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout + 10,  # Extra time for container startup
            )

            results = []
            if result.stdout:
                results.append({"type": "text/plain", "data": result.stdout})

            return ExecutionResult(
                success=result.returncode == 0,
                stdout=result.stdout,
                stderr=result.stderr,
                results=results,
                error=result.stderr if result.returncode != 0 else None,
            )

        except subprocess.TimeoutExpired:
            return ExecutionResult(
                success=False,
                error=f"Docker execution timeout ({timeout}s)",
            )
        except Exception as e:
            return ExecutionResult(
                success=False,
                error=f"Docker execution error: {str(e)}",
            )

    def close(self) -> None:
        """No persistent resources to clean up"""
        pass


# =============================================================================
# Factory Function
# =============================================================================

_executor: Optional[SandboxExecutor] = None


def get_executor() -> SandboxExecutor:
    """
    Get the sandbox executor based on SANDBOX_MODE environment variable

    SANDBOX_MODE options:
      - "e2b"      : Sync E2B cloud sandbox (default).
                     NOTE: We intentionally default to the sync executor to avoid
                     event-loop lifecycle issues when running in predominantly
                     synchronous tool call stacks.
      - "e2b-sync" : Alias for "e2b" (sync E2B executor).
      - "e2b-async": Async E2B cloud sandbox (experimental).
                     Uses asyncio.Lock for true parallel SubAgent execution.
      - "local"    : Local subprocess (development only, no isolation)
      - "docker"   : Not yet implemented (planned).

    Returns:
        SandboxExecutor instance
    """
    global _executor

    if _executor is not None:
        return _executor

    mode = os.environ.get("SANDBOX_MODE", "e2b").lower()

    if mode == "local":
        _executor = LocalSubprocessExecutor()
    elif mode == "docker":
        raise RuntimeError(
            "SANDBOX_MODE=docker is not yet implemented. "
            "Use 'e2b' (cloud) or 'local' (local-dev only) for now."
        )
    elif mode in ("e2b", "e2b-sync"):
        # Sync executor with threading.Lock (stable default)
        _executor = E2BSandboxExecutor()
    elif mode == "e2b-async":
        # Async executor with asyncio.Lock for parallel SubAgent execution (experimental)
        _executor = AsyncE2BSandboxExecutor()
    else:
        raise RuntimeError(
            f"Unknown SANDBOX_MODE={mode!r}; expected one of: e2b, e2b-sync, "
            "e2b-async, local. ('docker' is planned but not implemented.)"
        )

    return _executor


def execute_python(
    code: str,
    timeout: int = 300,
    files: list[dict] | None = None,
    user_id: str = "default",
    thread_id: Optional[str] = None,
) -> dict:
    """
    Execute Python code in the configured sandbox

    This is the main entry point for code execution.
    The sandbox mode is determined by SANDBOX_MODE environment variable.

    Args:
        code: Python code to execute
        timeout: Maximum execution time in seconds
        files: Optional list of file dicts with 'storage_path' key to sync before execution
        user_id: User ID for file ownership (used for saving generated files)
        thread_id: Thread ID for file-thread associations

    Returns:
        dict with keys: success, stdout, stderr, results, error, generated_files

    Example:
        result = execute_python('''
        import pandas as pd
        df = pd.DataFrame({'x': [1, 2, 3], 'y': [4, 5, 6]})
        print(df.corr())
        ''', user_id="user-123", thread_id="thread-456")

        if result['success']:
            print(result['stdout'])
        else:
            print(f"Error: {result['error']}")
    """
    # Normalize/validate context. When user_id context is missing (""), E2B sandbox
    # selection and storage sync can silently create extra sandboxes and/or mix
    # files across users. Prefer resolving via thread_id; otherwise fail fast.
    user_id = (user_id or "").strip()
    if thread_id == "default":
        thread_id = None

    if user_id in ("", "default", "anonymous") and thread_id:
        try:
            from ..storage.supabase_db import USE_SUPABASE_DB, get_thread_by_langgraph_id

            if USE_SUPABASE_DB:
                import asyncio

                async def _get_user_id() -> Optional[str]:
                    record = await get_thread_by_langgraph_id(thread_id)
                    if record and isinstance(record.get("user_id"), str):
                        return record["user_id"]
                    return None

                try:
                    asyncio.get_running_loop()
                except RuntimeError:
                    resolved = asyncio.run(_get_user_id())
                    if resolved:
                        user_id = resolved
        except Exception:
            # Best-effort only; fall through to validation.
            pass

    if user_id in ("", "default", "anonymous"):
        return {
            "success": False,
            "stdout": "",
            "stderr": "",
            "results": [],
            "error": (
                "Missing authenticated user context (user_id).\n"
                "Please refresh the page and sign in again."
            ),
            "generated_files": [],
        }

    if os.environ.get("SANDBOX_MODE", "e2b").lower() in {"e2b", "e2b-sync", "e2b-async"}:
        from ..usage_limits import enforce_e2b_usage_limit_sync

        enforce_e2b_usage_limit_sync(user_id)

    executor = get_executor()

    # Sync files if provided (for explicit file sync before execution)
    # Note: E2BSandboxExecutor and AsyncE2BSandboxExecutor handle file sync internally
    # via _ensure_files_synced(), so we only need to handle local mode here
    if files:
        try:
            from .file_sync import sync_files_to_e2b, sync_files_to_local

            mode = os.environ.get("SANDBOX_MODE", "e2b").lower()

            if mode == "local":
                sync_files_to_local(files)
            elif mode == "e2b-sync" and isinstance(executor, E2BSandboxExecutor):
                # Legacy sync executor - explicit file sync
                sandbox = executor._get_sandbox(user_id)
                sync_files_to_e2b(sandbox, files)
            # AsyncE2BSandboxExecutor handles file sync internally in _ensure_files_synced()
            # Docker mode file sync not implemented yet

        except Exception as e:
            return {
                "success": False,
                "stdout": "",
                "stderr": "",
                "results": [],
                "error": f"File sync error: {str(e)}",
                "generated_files": [],
            }

    if os.environ.get("SANDBOX_MODE", "e2b").lower() in {"e2b", "e2b-sync", "e2b-async"}:
        from ..usage_limits import e2b_usage_concurrency_sync

        with e2b_usage_concurrency_sync(user_id):
            result = executor.execute(code, timeout, user_id, thread_id)
    else:
        result = executor.execute(code, timeout, user_id, thread_id)
    return result.to_dict()


def cleanup_executor() -> None:
    """Clean up the global executor instance"""
    global _executor
    if _executor is not None:
        _executor.close()
        _executor = None
