"""
File Storage Module for Context Offloading

Implements Manus's "filesystem as infinite context" strategy:
- Large outputs are saved to files instead of chat context
- File paths are kept in context for recovery
- This is "reversible compression" - data can be retrieved when needed

Key insight from Manus:
- "Sandbox files = Disk (cheap, unlimited)"
- "Keep URLs/paths for recovery, not the full content"
"""

import os
import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional, Any
import tempfile


# =============================================================================
# Configuration
# =============================================================================

# Base directory for result files
# Uses the same temp directory structure as sandbox file sync
RESULTS_DIR = Path(tempfile.gettempdir()) / "data-analyst-sandbox" / "results"

# Size threshold for saving to file (characters)
FILE_SAVE_THRESHOLD = 3000

# Maximum age of result files before cleanup (hours)
MAX_RESULT_AGE_HOURS = 24


# =============================================================================
# File Operations
# =============================================================================

def ensure_results_dir() -> Path:
    """Ensure the results directory exists."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    return RESULTS_DIR


def generate_result_id(content: str) -> str:
    """
    Generate a unique ID for a result based on content hash.

    Uses MD5 hash of content + timestamp for uniqueness.
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    content_hash = hashlib.md5(content.encode()).hexdigest()[:8]
    return f"{timestamp}_{content_hash}"


def get_result_file_path(result_id: str, extension: str = "txt") -> Path:
    """Get the file path for a result."""
    ensure_results_dir()
    return RESULTS_DIR / f"result_{result_id}.{extension}"


def save_result_to_file(
    content: str,
    result_type: str = "output",
    metadata: Optional[dict] = None,
) -> dict:
    """
    Save execution result to a file.

    Args:
        content: The content to save
        result_type: Type of result ("output", "dataframe", "regression", etc.)
        metadata: Additional metadata to save alongside

    Returns:
        dict with:
        - result_id: Unique identifier for this result
        - file_path: Path where result was saved
        - summary: Brief summary for context
        - size: Size of saved content
    """
    result_id = generate_result_id(content)
    file_path = get_result_file_path(result_id)

    # Create result package
    result_package = {
        "result_id": result_id,
        "result_type": result_type,
        "timestamp": datetime.now().isoformat(),
        "size": len(content),
        "metadata": metadata or {},
        "content": content,
    }

    # Save as JSON for structured access
    json_path = get_result_file_path(result_id, "json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result_package, f, indent=2, ensure_ascii=False)

    # Also save raw content for easy viewing
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    # Generate a brief summary
    lines = content.split('\n')
    if len(lines) > 5:
        summary = '\n'.join(lines[:3]) + f"\n... ({len(lines)} total lines)"
    else:
        summary = content[:500]

    return {
        "result_id": result_id,
        "file_path": str(file_path),
        "json_path": str(json_path),
        "summary": summary,
        "size": len(content),
        "result_type": result_type,
    }


def load_result_from_file(result_id: str) -> Optional[dict]:
    """
    Load a saved result by ID.

    Args:
        result_id: The result identifier

    Returns:
        Full result package including content, or None if not found
    """
    json_path = get_result_file_path(result_id, "json")

    if not json_path.exists():
        return None

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading result {result_id}: {e}")
        return None


def load_result_content(result_id: str) -> Optional[str]:
    """
    Load just the content of a saved result.

    Args:
        result_id: The result identifier

    Returns:
        The raw content string, or None if not found
    """
    result = load_result_from_file(result_id)
    if result:
        return result.get("content")
    return None


def list_saved_results(max_age_hours: Optional[int] = None) -> list[dict]:
    """
    List all saved results.

    Args:
        max_age_hours: Only return results newer than this (None for all)

    Returns:
        List of result metadata (without full content)
    """
    ensure_results_dir()
    results = []

    cutoff_time = None
    if max_age_hours:
        cutoff_time = datetime.now().timestamp() - (max_age_hours * 3600)

    for json_file in RESULTS_DIR.glob("result_*.json"):
        if cutoff_time and json_file.stat().st_mtime < cutoff_time:
            continue

        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Return metadata without full content
                results.append({
                    "result_id": data.get("result_id"),
                    "result_type": data.get("result_type"),
                    "timestamp": data.get("timestamp"),
                    "size": data.get("size"),
                    "file_path": str(json_file),
                })
        except (json.JSONDecodeError, IOError):
            continue

    return sorted(results, key=lambda x: x.get("timestamp", ""), reverse=True)


def cleanup_old_results(max_age_hours: int = MAX_RESULT_AGE_HOURS) -> int:
    """
    Remove old result files.

    Args:
        max_age_hours: Remove results older than this

    Returns:
        Number of files removed
    """
    ensure_results_dir()
    cutoff_time = datetime.now().timestamp() - (max_age_hours * 3600)
    removed = 0

    for file_path in RESULTS_DIR.glob("result_*"):
        if file_path.stat().st_mtime < cutoff_time:
            try:
                file_path.unlink()
                removed += 1
            except OSError:
                pass

    return removed


# =============================================================================
# Context Recovery
# =============================================================================

def format_file_reference(result_info: dict) -> str:
    """
    Format a file reference for inclusion in LLM context.

    This creates a "recoverable" reference that the agent can use
    to retrieve full content when needed.
    """
    return (
        f"[Result saved: {result_info['result_id']}]\n"
        f"Type: {result_info.get('result_type', 'output')}\n"
        f"Size: {result_info['size']} chars\n"
        f"Path: {result_info['file_path']}\n"
        f"Preview: {result_info.get('summary', '')[:200]}"
    )


def should_save_to_file(content: str) -> bool:
    """
    Determine if content should be saved to file.

    Based on size threshold and content type.
    """
    return len(content) > FILE_SAVE_THRESHOLD
