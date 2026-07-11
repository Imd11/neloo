"""
Text Extractor - Extract text from PDF with position information
Based on SmartResume's text extraction logic
"""

import io
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class TextBlock:
    """A block of text with position information"""

    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    page: int
    line_index: int  # Global line index for reference


@dataclass
class ExtractedText:
    """Result of text extraction"""

    text_lines: List[str]  # Lines for index-based reference
    text_blocks: List[TextBlock]  # Blocks with position
    full_text: str  # Combined text
    page_count: int
    has_layout_info: bool


def extract_text_from_pdf(pdf_bytes: bytes) -> ExtractedText:
    """
    Extract text from PDF with position information

    Args:
        pdf_bytes: PDF file content as bytes

    Returns:
        ExtractedText with lines and position information
    """
    import pdfplumber

    text_blocks: List[TextBlock] = []
    all_lines: List[str] = []
    line_index = 0

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page_count = len(pdf.pages)

        for page_num, page in enumerate(pdf.pages):
            # Extract words with position
            words = page.extract_words(keep_blank_chars=True, x_tolerance=3, y_tolerance=3)

            if not words:
                continue

            # Group words into lines based on Y position
            lines = group_words_into_lines(words, page_num)

            for line_words, y_pos in lines:
                # Combine words into line text
                line_text = " ".join([w["text"] for w in line_words])
                line_text = line_text.strip()

                if not line_text:
                    continue

                # Get bounding box
                x0 = min(w["x0"] for w in line_words)
                x1 = max(w["x1"] for w in line_words)
                y0 = min(w["top"] for w in line_words)
                y1 = max(w["bottom"] for w in line_words)

                text_blocks.append(
                    TextBlock(
                        text=line_text,
                        x0=x0,
                        y0=y0,
                        x1=x1,
                        y1=y1,
                        page=page_num,
                        line_index=line_index,
                    )
                )

                all_lines.append(line_text)
                line_index += 1

    # Build full text with line numbers for reference
    full_text = "\n".join([f"[{i}] {line}" for i, line in enumerate(all_lines)])

    return ExtractedText(
        text_lines=all_lines,
        text_blocks=text_blocks,
        full_text=full_text,
        page_count=page_count,
        has_layout_info=True,
    )


def group_words_into_lines(
    words: List[Dict[str, Any]], page_num: int, y_tolerance: float = 5
) -> List[Tuple[List[Dict], float]]:
    """
    Group words into lines based on Y position

    Args:
        words: List of word dictionaries from pdfplumber
        page_num: Current page number
        y_tolerance: Maximum Y difference to consider same line

    Returns:
        List of (words_in_line, y_position) tuples
    """
    if not words:
        return []

    # Sort by Y (top), then X (left)
    sorted_words = sorted(words, key=lambda w: (w["top"], w["x0"]))

    lines: List[Tuple[List[Dict], float]] = []
    current_line: List[Dict] = []
    current_y = sorted_words[0]["top"]

    for word in sorted_words:
        if abs(word["top"] - current_y) > y_tolerance:
            if current_line:
                # Sort line by X position
                current_line.sort(key=lambda w: w["x0"])
                lines.append((current_line, current_y))
            current_line = [word]
            current_y = word["top"]
        else:
            current_line.append(word)

    # Don't forget last line
    if current_line:
        current_line.sort(key=lambda w: w["x0"])
        lines.append((current_line, current_y))

    return lines


def detect_columns(text_blocks: List[TextBlock], page_width: float) -> Optional[float]:
    """
    Detect if the document has a two-column layout

    Args:
        text_blocks: List of text blocks with positions
        page_width: Width of the page

    Returns:
        Column split X position if two-column, None otherwise
    """
    if not text_blocks:
        return None

    # Collect X center positions
    x_centers = [(block.x0 + block.x1) / 2 for block in text_blocks]

    # Calculate histogram
    bucket_size = 20
    buckets: Dict[int, int] = {}

    for x in x_centers:
        bucket = int(x / bucket_size)
        buckets[bucket] = buckets.get(bucket, 0) + 1

    # Find gap in the middle 30%-70% range
    mid_start = int(page_width * 0.3 / bucket_size)
    mid_end = int(page_width * 0.7 / bucket_size)

    max_gap_start = -1
    max_gap_length = 0
    current_gap_start = -1
    current_gap_length = 0

    for i in range(mid_start, mid_end + 1):
        if buckets.get(i, 0) < 2:  # Low density = gap
            if current_gap_start == -1:
                current_gap_start = i
            current_gap_length += 1
        else:
            if current_gap_length > max_gap_length:
                max_gap_start = current_gap_start
                max_gap_length = current_gap_length
            current_gap_start = -1
            current_gap_length = 0

    if current_gap_length > max_gap_length:
        max_gap_start = current_gap_start
        max_gap_length = current_gap_length

    # Require at least 2 buckets (40px) gap
    if max_gap_length >= 2 and max_gap_start != -1:
        return (max_gap_start + max_gap_length / 2) * bucket_size

    return None


def reorder_by_layout(
    text_blocks: List[TextBlock], column_split: Optional[float] = None
) -> List[TextBlock]:
    """
    Reorder text blocks based on layout (columns, reading order)

    Args:
        text_blocks: Original text blocks
        column_split: X position of column split, if any

    Returns:
        Reordered text blocks
    """
    if not text_blocks:
        return []

    if column_split is None:
        # Single column - sort by Y, then X
        return sorted(text_blocks, key=lambda b: (b.page, b.y0, b.x0))

    # Two columns - process each column separately
    left_blocks = [b for b in text_blocks if (b.x0 + b.x1) / 2 < column_split]
    right_blocks = [b for b in text_blocks if (b.x0 + b.x1) / 2 >= column_split]

    # Sort each column by Y
    left_blocks.sort(key=lambda b: (b.page, b.y0))
    right_blocks.sort(key=lambda b: (b.page, b.y0))

    # Combine: left column first, then right column
    # (can be customized based on layout detection)
    return left_blocks + right_blocks


def build_indexed_text(text_blocks: List[TextBlock]) -> Tuple[List[str], str]:
    """
    Build text with line indices for LLM reference

    Args:
        text_blocks: Ordered text blocks

    Returns:
        (list of lines, formatted text with indices)
    """
    lines = [block.text for block in text_blocks]

    # Build text with line numbers
    indexed_lines = []
    for i, line in enumerate(lines):
        indexed_lines.append(f"[{i}] {line}")

    indexed_text = "\n".join(indexed_lines)

    return lines, indexed_text
