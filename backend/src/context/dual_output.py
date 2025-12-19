"""
Dual-Form Output Module

Implements the core Manus strategy: every tool result has two forms:
1. Full output: Complete data for user display
2. Summary output: Compressed version for LLM context

Key insight from Manus:
- "Why does df.head() work? Because it's a natural compression"
- "The LLM doesn't need all 10000 rows to understand the data"
"""

import re
from dataclasses import dataclass
from typing import Optional


# =============================================================================
# Configuration
# =============================================================================

# Threshold for triggering compression (characters)
OUTPUT_SIZE_THRESHOLD = 2000

# Maximum summary size for LLM
MAX_SUMMARY_SIZE = 1500

# Maximum number of rows to show in DataFrame preview
MAX_PREVIEW_ROWS = 10

# Maximum number of columns to show in wide DataFrames
MAX_PREVIEW_COLS = 10


# =============================================================================
# Dual-Form Result
# =============================================================================

@dataclass
class DualFormResult:
    """
    Result with both full and summary forms.

    Attributes:
        full_output: Complete output for user display
        summary_output: Compressed output for LLM context
        file_path: Optional path where full output is stored
        was_compressed: Whether compression was applied
        metadata: Additional info about the result
    """
    full_output: str
    summary_output: str
    file_path: Optional[str] = None
    was_compressed: bool = False
    metadata: dict = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


# =============================================================================
# Summarization Functions
# =============================================================================

def summarize_dataframe_output(output: str) -> str:
    """
    Summarize DataFrame-like output.

    Detects pandas DataFrame output patterns and creates a summary:
    - Shape information
    - Column names and types
    - First few rows preview
    - Statistics summary
    """
    lines = output.strip().split('\n')

    # Check if this looks like a DataFrame output
    if len(lines) < 5:
        return output[:MAX_SUMMARY_SIZE]

    summary_parts = []

    # Look for shape info
    shape_match = re.search(r'\((\d+),?\s*(\d+)?\)', output)
    if shape_match:
        rows = shape_match.group(1)
        cols = shape_match.group(2) or "?"
        summary_parts.append(f"[DataFrame: {rows} rows × {cols} columns]")

    # Extract column info if present (from .info() output)
    dtypes_section = re.search(r'dtypes:(.+?)(?:memory|$)', output, re.DOTALL)
    if dtypes_section:
        summary_parts.append(f"Types: {dtypes_section.group(1).strip()}")

    # Keep first few lines as preview
    preview_lines = lines[:MAX_PREVIEW_ROWS]
    summary_parts.append("Preview:\n" + '\n'.join(preview_lines))

    # If there are more lines, add truncation notice
    if len(lines) > MAX_PREVIEW_ROWS:
        summary_parts.append(f"... ({len(lines) - MAX_PREVIEW_ROWS} more lines)")

    return '\n'.join(summary_parts)[:MAX_SUMMARY_SIZE]


def summarize_regression_output(output: str) -> str:
    """
    Summarize statsmodels regression output.

    Extracts key statistics:
    - R-squared
    - F-statistic
    - Key coefficients
    - Significance indicators
    """
    summary_parts = []

    # Extract R-squared
    r2_match = re.search(r'R-squared[:\s]+([0-9.]+)', output)
    if r2_match:
        summary_parts.append(f"R² = {r2_match.group(1)}")

    # Extract Adjusted R-squared
    adj_r2_match = re.search(r'Adj\.\s*R-squared[:\s]+([0-9.]+)', output)
    if adj_r2_match:
        summary_parts.append(f"Adj. R² = {adj_r2_match.group(1)}")

    # Extract F-statistic
    f_match = re.search(r'F-statistic[:\s]+([0-9.]+)', output)
    if f_match:
        summary_parts.append(f"F = {f_match.group(1)}")

    # Extract number of observations
    nobs_match = re.search(r'No\.\s*Observations[:\s]+(\d+)', output)
    if nobs_match:
        summary_parts.append(f"N = {nobs_match.group(1)}")

    # Extract coefficient table (simplified)
    coef_section = re.search(r'coef\s+std err(.+?)(?:==|Omnibus|$)', output, re.DOTALL)
    if coef_section:
        coef_lines = coef_section.group(1).strip().split('\n')[:10]  # First 10 coefficients
        summary_parts.append("Coefficients (top):\n" + '\n'.join(coef_lines))

    if summary_parts:
        return "[Regression Summary]\n" + '\n'.join(summary_parts)

    # Fallback: just truncate
    return output[:MAX_SUMMARY_SIZE]


def summarize_error_output(output: str) -> str:
    """
    Summarize error/traceback output.

    Keeps the error type and message, removes redundant stack frames.
    """
    lines = output.strip().split('\n')

    # Find the actual error message (usually at the end)
    error_lines = []
    for i, line in enumerate(reversed(lines)):
        error_lines.insert(0, line)
        if line.strip().startswith(('Error:', 'Exception:', 'Traceback')):
            break
        if len(error_lines) > 5:  # Keep last 5 lines max
            break

    return '\n'.join(error_lines)


def summarize_for_llm(output: str, output_type: str = "auto") -> str:
    """
    Create a summary of output suitable for LLM context.

    Args:
        output: The full output to summarize
        output_type: Type hint ("dataframe", "regression", "error", "auto")

    Returns:
        Summarized output that preserves key information
    """
    if len(output) <= OUTPUT_SIZE_THRESHOLD:
        return output

    # Auto-detect output type
    if output_type == "auto":
        if "R-squared" in output or "OLS Regression" in output:
            output_type = "regression"
        elif "DataFrame" in output or "dtype:" in output or re.search(r'\d+\s+\d+', output):
            output_type = "dataframe"
        elif "Error" in output or "Traceback" in output:
            output_type = "error"
        else:
            output_type = "generic"

    # Apply appropriate summarization
    if output_type == "regression":
        return summarize_regression_output(output)
    elif output_type == "dataframe":
        return summarize_dataframe_output(output)
    elif output_type == "error":
        return summarize_error_output(output)
    else:
        # Generic: keep first and last portions
        half_size = MAX_SUMMARY_SIZE // 2
        return output[:half_size] + "\n...[truncated]...\n" + output[-half_size:]


# =============================================================================
# Dual Output Creation
# =============================================================================

def create_dual_output(
    output: str,
    output_type: str = "auto",
    force_compress: bool = False,
) -> DualFormResult:
    """
    Create a dual-form result from execution output.

    This is the main entry point for the dual-output system.

    Args:
        output: Raw execution output
        output_type: Type hint for summarization
        force_compress: Force compression even for small outputs

    Returns:
        DualFormResult with both full and summary forms

    Example:
        result = create_dual_output(df.to_string())
        # result.full_output -> complete DataFrame
        # result.summary_output -> compressed preview for LLM
    """
    needs_compression = force_compress or len(output) > OUTPUT_SIZE_THRESHOLD

    if needs_compression:
        summary = summarize_for_llm(output, output_type)
        return DualFormResult(
            full_output=output,
            summary_output=summary,
            was_compressed=True,
            metadata={
                "original_size": len(output),
                "summary_size": len(summary),
                "compression_ratio": len(summary) / len(output) if output else 1.0,
                "output_type": output_type,
            }
        )
    else:
        return DualFormResult(
            full_output=output,
            summary_output=output,
            was_compressed=False,
            metadata={
                "original_size": len(output),
                "output_type": output_type,
            }
        )


def format_llm_response(dual_result: DualFormResult) -> str:
    """
    Format the dual result for inclusion in LLM context.

    If the result was compressed and saved to file, includes the file path
    for potential recovery.

    This implements Manus's "reversible compression" strategy.
    """
    if not dual_result.was_compressed:
        return dual_result.full_output

    parts = [dual_result.summary_output]

    if dual_result.file_path:
        parts.append(f"\n[Full output saved to: {dual_result.file_path}]")

    return '\n'.join(parts)
