"""
Context Engineering Module

Implements Manus-style context management strategies:
1. Dual-form output: Full results for users, summaries for LLM
2. File-based storage: Large outputs saved to filesystem
3. Reversible compression: Keep paths/URLs for recovery

Reference: Peak's Context Engineering talk
- "Chat window = RAM (expensive, limited)"
- "Sandbox files = Disk (cheap, unlimited)"
"""

from .dual_output import DualFormResult, create_dual_output, summarize_for_llm
from .file_storage import (
    RESULTS_DIR,
    format_file_reference,
    get_result_file_path,
    load_result_from_file,
    save_result_to_file,
    should_save_to_file,
)

__all__ = [
    "DualFormResult",
    "create_dual_output",
    "summarize_for_llm",
    "save_result_to_file",
    "load_result_from_file",
    "get_result_file_path",
    "should_save_to_file",
    "format_file_reference",
    "RESULTS_DIR",
]
