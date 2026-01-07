"""
Sandbox Execution Module

Provides secure code execution environments:
- E2B: Cloud sandbox (production)
- Local: Subprocess execution (development only)
- Docker: Container-based execution (self-hosted)

Also provides:
- File synchronization from Supabase Storage to sandbox
- E2B Sandbox Backend for DeepAgents FilesystemMiddleware integration
"""

from .executor import get_executor, execute_python
from .file_sync import (
    get_file_content,
    sync_file_to_local,
    sync_file_to_e2b,
    sync_files_to_local,
    sync_files_to_e2b,
    get_sandbox_file_path,
    get_local_data_dir,
)
from .backend import E2BSandboxBackend, get_e2b_backend_factory

__all__ = [
    "get_executor",
    "execute_python",
    "get_file_content",
    "sync_file_to_local",
    "sync_file_to_e2b",
    "sync_files_to_local",
    "sync_files_to_e2b",
    "get_sandbox_file_path",
    "get_local_data_dir",
    "E2BSandboxBackend",
    "get_e2b_backend_factory",
]
