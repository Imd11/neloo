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

import os
import sys
import subprocess
import tempfile
import base64
from abc import ABC, abstractmethod
from typing import Optional, Any
from dataclasses import dataclass, field


@dataclass
class ExecutionResult:
    """Result of code execution"""
    success: bool
    stdout: str = ""
    stderr: str = ""
    results: list[dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None
    generated_files: list[dict[str, Any]] = field(default_factory=list)  # New files created during execution

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
    def execute(self, code: str, timeout: int = 300) -> ExecutionResult:
        """Execute Python code and return the result"""
        pass

    @abstractmethod
    def close(self) -> None:
        """Clean up resources"""
        pass


# =============================================================================
# E2B Cloud Sandbox Executor (Production)
# =============================================================================

class E2BSandboxExecutor(SandboxExecutor):
    """
    E2B Cloud Sandbox Executor

    Executes code in E2B's secure cloud sandbox environment.
    Pre-installed packages: pandas, numpy, scipy, statsmodels, matplotlib

    Requires: E2B_API_KEY environment variable
    """

    def __init__(self):
        """
        Initialize E2B executor

        Note: E2B code-interpreter SDK uses a default template,
        no custom template parameter is needed.
        """
        self._sandbox = None

    def _get_sandbox(self):
        """Lazy initialization of sandbox"""
        if self._sandbox is None:
            try:
                from e2b_code_interpreter import Sandbox
                self._sandbox = Sandbox()
            except ImportError:
                raise ImportError(
                    "e2b-code-interpreter is required for E2B sandbox. "
                    "Install with: pip install e2b-code-interpreter"
                )
            except Exception as e:
                raise RuntimeError(f"Failed to create E2B sandbox: {e}")
        return self._sandbox

    def execute(self, code: str, timeout: int = 300) -> ExecutionResult:
        """Execute code in E2B sandbox"""
        try:
            sandbox = self._get_sandbox()
            execution = sandbox.run_code(code, timeout=timeout)

            # Process results
            results = []
            if execution.results:
                for r in execution.results:
                    if hasattr(r, 'png') and r.png:
                        results.append({"type": "image/png", "data": r.png})
                    elif hasattr(r, 'html') and r.html:
                        results.append({"type": "text/html", "data": r.html})
                    elif hasattr(r, 'text') and r.text:
                        results.append({"type": "text/plain", "data": r.text})
                    elif hasattr(r, 'latex') and r.latex:
                        results.append({"type": "text/latex", "data": r.latex})

            return ExecutionResult(
                success=execution.error is None,
                stdout=execution.logs.stdout if execution.logs else "",
                stderr=execution.logs.stderr if execution.logs else "",
                results=results,
                error=str(execution.error) if execution.error else None,
            )

        except Exception as e:
            return ExecutionResult(
                success=False,
                error=f"E2B execution error: {str(e)}",
            )

    def close(self) -> None:
        """Close the sandbox"""
        if self._sandbox is not None:
            try:
                self._sandbox.close()
            except Exception:
                pass
            self._sandbox = None


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
        self._data_dir = None

    def _get_data_dir(self) -> str:
        """Get or create the local data directory for file storage."""
        if self._data_dir is None:
            from .file_sync import get_local_data_dir
            self._data_dir = str(get_local_data_dir())
        return self._data_dir

    def _rewrite_paths(self, code: str) -> str:
        """
        Rewrite /home/user/data/ paths to actual local data directory.

        This allows code written for E2B sandbox to work in local mode.
        """
        local_data_dir = self._get_data_dir()
        # Replace the sandbox path with local path
        return code.replace("/home/user/data/", f"{local_data_dir}/")

    def _get_data_dir_snapshot(self) -> dict[str, float]:
        """
        Get a snapshot of files in data directory with their modification times.

        Returns:
            Dict mapping filename to modification time
        """
        data_dir = self._get_data_dir()
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
    ) -> list[dict[str, Any]]:
        """
        Detect new or modified files by comparing snapshots.

        Args:
            before: Snapshot before execution
            after: Snapshot after execution

        Returns:
            List of file info dicts with filename, size, and sandbox_path
        """
        data_dir = self._get_data_dir()
        new_files = []

        for filename, mtime in after.items():
            # Check if file is new or modified
            if filename not in before or mtime > before[filename]:
                file_path = os.path.join(data_dir, filename)
                try:
                    size = os.path.getsize(file_path)
                    new_files.append({
                        "filename": filename,
                        "size": size,
                        "sandbox_path": f"/home/user/data/{filename}",
                        "local_path": file_path,
                    })
                except Exception:
                    pass

        return new_files

    def execute(self, code: str, timeout: int = 300) -> ExecutionResult:
        """Execute code locally via subprocess with image capture support"""
        # Auto-sync Supabase files to local before execution
        # This ensures all user-uploaded files are available in the local sandbox
        try:
            from .file_sync import sync_all_supabase_files_to_local
            synced_files = sync_all_supabase_files_to_local()
            if synced_files:
                print(f"[LocalExecutor] {len(synced_files)} files available for execution")
        except Exception as e:
            print(f"[LocalExecutor] Warning: Failed to sync files from storage: {e}")

        # Take snapshot of data directory before execution
        files_before = self._get_data_dir_snapshot()

        # Rewrite /home/user/data/ paths to local data directory
        code = self._rewrite_paths(code)

        # Create a temp directory for this execution
        temp_dir = tempfile.mkdtemp(prefix="sandbox_")
        temp_script = os.path.join(temp_dir, "script.py")
        temp_images_dir = os.path.join(temp_dir, "images")
        os.makedirs(temp_images_dir, exist_ok=True)

        # Wrapper code to capture matplotlib figures
        wrapper_code = f'''
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
'''

        # Write the wrapper script
        with open(temp_script, 'w', encoding='utf-8') as f:
            f.write(wrapper_code)

        try:
            result = subprocess.run(
                [sys.executable, temp_script],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=temp_dir,
                env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            )

            results = []

            # Capture text output
            if result.stdout:
                results.append({"type": "text/plain", "data": result.stdout})

            # Capture generated images
            if os.path.exists(temp_images_dir):
                image_files = sorted([
                    f for f in os.listdir(temp_images_dir)
                    if f.endswith('.png')
                ])
                for img_file in image_files:
                    img_path = os.path.join(temp_images_dir, img_file)
                    try:
                        with open(img_path, 'rb') as f:
                            img_data = base64.b64encode(f.read()).decode('utf-8')
                            results.append({"type": "image/png", "data": img_data})
                    except Exception:
                        pass

            # Detect new files created during execution
            files_after = self._get_data_dir_snapshot()
            generated_files = self._detect_new_files(files_before, files_after)
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
                "Docker is not installed. "
                "Please install Docker or use a different sandbox mode."
            )

    def execute(self, code: str, timeout: int = 300) -> ExecutionResult:
        """Execute code in Docker container"""
        # Base64 encode to avoid shell escaping issues
        code_b64 = base64.b64encode(code.encode('utf-8')).decode('utf-8')

        # Build Docker command with security restrictions
        cmd = [
            "docker", "run", "--rm",
            "--network", "none",           # Disable network
            "--memory", "512m",            # Memory limit
            "--cpus", "1",                 # CPU limit
            "--pids-limit", "50",          # Process limit
            "--read-only",                 # Read-only filesystem
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=100m",  # Writable /tmp
            self.image,
            "python", "-c",
            f"import base64; exec(base64.b64decode('{code_b64}').decode('utf-8'))"
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
      - "e2b"   : E2B cloud sandbox (default, recommended for production)
      - "local" : Local subprocess (development only, no isolation)
      - "docker": Docker container (self-hosted, secure)

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
        _executor = DockerExecutor()
    else:  # Default to e2b
        _executor = E2BSandboxExecutor()

    return _executor


def execute_python(code: str, timeout: int = 300, files: list[dict] | None = None) -> dict:
    """
    Execute Python code in the configured sandbox

    This is the main entry point for code execution.
    The sandbox mode is determined by SANDBOX_MODE environment variable.

    Args:
        code: Python code to execute
        timeout: Maximum execution time in seconds
        files: Optional list of file dicts with 'storage_path' key to sync before execution

    Returns:
        dict with keys: success, stdout, stderr, results, error

    Example:
        result = execute_python('''
        import pandas as pd
        df = pd.DataFrame({'x': [1, 2, 3], 'y': [4, 5, 6]})
        print(df.corr())
        ''')

        if result['success']:
            print(result['stdout'])
        else:
            print(f"Error: {result['error']}")
    """
    executor = get_executor()

    # Sync files if provided
    if files:
        try:
            from .file_sync import sync_files_to_local, sync_files_to_e2b

            mode = os.environ.get("SANDBOX_MODE", "e2b").lower()

            if mode == "local":
                sync_files_to_local(files)
            elif mode == "e2b" and isinstance(executor, E2BSandboxExecutor):
                sandbox = executor._get_sandbox()
                sync_files_to_e2b(sandbox, files)
            # Docker mode file sync not implemented yet

        except Exception as e:
            return {
                "success": False,
                "stdout": "",
                "stderr": "",
                "results": [],
                "error": f"File sync error: {str(e)}",
            }

    result = executor.execute(code, timeout)
    return result.to_dict()


def cleanup_executor() -> None:
    """Clean up the global executor instance"""
    global _executor
    if _executor is not None:
        _executor.close()
        _executor = None
