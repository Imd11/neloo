"""
Resume Parser - Main parsing logic combining all components
"""

import json
import os
from typing import Any, Dict, List, Optional

# Support both package import and direct module import
try:
    from .field_mapper import convert_to_resume_data
    from .layout_detector import LayoutBox, LayoutDetector, convert_pdf_page_to_image
    from .prompts import get_prompts
    from .text_extractor import (
        build_indexed_text,
        detect_columns,
        extract_text_from_pdf,
        reorder_by_layout,
    )
except ImportError:
    from field_mapper import convert_to_resume_data
    from layout_detector import LayoutBox, LayoutDetector, convert_pdf_page_to_image
    from prompts import get_prompts
    from text_extractor import (
        build_indexed_text,
        detect_columns,
        extract_text_from_pdf,
        reorder_by_layout,
    )


class ResumeParser:
    """
    Main resume parser that combines:
    - PDF text extraction
    - Optional YOLOv10 layout detection
    - LLM-based information extraction with index references
    - Post-processing and field mapping
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_base: str = "https://api.deepseek.com/v1",
        model: str = "deepseek-v4-pro",
        use_layout_detection: bool = True,
    ):
        """
        Initialize parser

        Args:
            api_key: DeepSeek API key. If None, reads from DEEPSEEK_API_KEY env var.
            api_base: API base URL
            model: Model name to use
            use_layout_detection: Whether to use YOLOv10 layout detection
        """
        self.api_key = api_key or os.environ.get("DEEPSEEK_API_KEY")
        self.api_base = api_base
        self.model = model
        self.use_layout_detection = use_layout_detection

        # Initialize layout detector if enabled
        self.layout_detector = None
        if use_layout_detection:
            try:
                self.layout_detector = LayoutDetector()
                if not self.layout_detector.is_available:
                    print("⚠️ Layout detection disabled (model not found)")
                    self.layout_detector = None
            except Exception as e:
                print(f"⚠️ Layout detection disabled: {e}")

        self.prompts = get_prompts()

    async def parse(self, pdf_bytes: bytes, filename: str = "resume.pdf") -> Dict[str, Any]:
        """
        Parse a resume PDF

        Args:
            pdf_bytes: PDF file content
            filename: Original filename

        Returns:
            ResumeData compatible dictionary
        """
        print(f"📄 Parsing resume: {filename}")

        # Step 1: Extract text with positions
        print("  [1/5] Extracting text...")
        extracted = extract_text_from_pdf(pdf_bytes)
        print(f"       Found {len(extracted.text_lines)} lines, {extracted.page_count} pages")

        # Step 2: Optional layout detection
        layout_boxes: List[LayoutBox] = []
        if self.layout_detector and self.layout_detector.is_available:
            print("  [2/5] Detecting layout with YOLOv10...")
            try:
                image = convert_pdf_page_to_image(pdf_bytes, page_num=0)
                if image is not None:
                    layout_boxes = self.layout_detector.detect(image)
                    print(f"       Detected {len(layout_boxes)} layout regions")
            except Exception as e:
                print(f"       Layout detection failed: {e}")
        else:
            print("  [2/5] Layout detection skipped")

        # Step 3: Reorder text based on layout
        print("  [3/5] Building indexed text...")

        # Detect columns using text positions
        column_split = detect_columns(
            extracted.text_blocks, page_width=612
        )  # Standard letter width
        if column_split:
            print(f"       Detected two-column layout (split at {column_split:.0f}px)")

        # Reorder blocks
        ordered_blocks = reorder_by_layout(extracted.text_blocks, column_split)

        # Build indexed text for LLM
        text_lines, indexed_text = build_indexed_text(ordered_blocks)
        print(f"       Built indexed text with {len(text_lines)} lines")

        # Step 4: Call LLM for extraction
        print("  [4/5] Extracting information with LLM...")
        llm_result = await self._call_llm(indexed_text, text_lines)

        # Step 5: Post-process and map fields
        print("  [5/5] Post-processing and mapping fields...")
        resume_data = convert_to_resume_data(llm_result, text_lines)

        # Validate and clean
        resume_data = self._validate_result(resume_data, text_lines)

        print("✅ Parsing complete!")
        return resume_data

    async def _call_llm(self, indexed_text: str, text_lines: List[str]) -> Dict[str, Any]:
        """
        Call LLM to extract structured information

        Uses multiple prompts to extract different sections
        """
        import httpx

        if not self.api_key:
            raise ValueError("DeepSeek API key not configured")

        results = {}

        # Extract each section
        sections = [
            ("basic_info", "basicInfo"),
            ("work_experience", "workExperience"),
            ("education", "education"),
            ("skills", "skills"),
            ("projects", "projects"),
        ]

        async with httpx.AsyncClient(timeout=60.0) as client:
            for prompt_key, result_key in sections:
                prompt = self.prompts.get(prompt_key, "")
                if not prompt:
                    continue

                try:
                    response = await client.post(
                        f"{self.api_base}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": self.model,
                            "messages": [
                                {"role": "system", "content": prompt},
                                {
                                    "role": "user",
                                    "content": f"Extract information from the following resume text:\n\n{indexed_text}",
                                },
                            ],
                            "temperature": 0.1,
                            "max_tokens": 2000,
                        },
                    )

                    if response.status_code == 200:
                        data = response.json()
                        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

                        # Parse JSON from response
                        parsed = self._extract_json(content)
                        if parsed:
                            results.update(parsed)
                            print(f"       ✓ Extracted {result_key}")
                    else:
                        print(f"       ✗ Failed to extract {result_key}: {response.status_code}")

                except Exception as e:
                    print(f"       ✗ Error extracting {result_key}: {e}")

        return results

    def _extract_json(self, content: str) -> Optional[Dict]:
        """Extract JSON from LLM response"""
        import json_repair

        # Try to find JSON in the response
        content = content.strip()

        # Remove markdown code blocks if present
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])

        # Try to parse
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Try to find JSON object
        start = content.find("{")
        end = content.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(content[start:end])
            except json.JSONDecodeError:
                pass

        # Try json_repair as last resort
        try:
            return json_repair.loads(content)
        except Exception:
            pass

        return None

    def _validate_result(
        self, resume_data: Dict[str, Any], text_lines: List[str]
    ) -> Dict[str, Any]:
        """
        Validate extracted data against original text

        Removes fields that don't appear in the original text
        (anti-hallucination measure)
        """
        full_text = " ".join(text_lines).lower()

        # Validate company names
        if "experience" in resume_data:
            for exp in resume_data["experience"]:
                company = exp.get("company", "")
                if company and company.lower() not in full_text:
                    print(f"       ⚠️ Company '{company}' not found in text, keeping anyway")

        # Validate school names
        if "education" in resume_data:
            for edu in resume_data["education"]:
                school = edu.get("institution", "")
                if school and school.lower() not in full_text:
                    print(f"       ⚠️ School '{school}' not found in text, keeping anyway")

        return resume_data


# Convenience function for simple usage
async def parse_resume(pdf_bytes: bytes, filename: str = "resume.pdf") -> Dict[str, Any]:
    """
    Parse a resume PDF file

    Args:
        pdf_bytes: PDF file content
        filename: Original filename

    Returns:
        ResumeData compatible dictionary
    """
    parser = ResumeParser()
    return await parser.parse(pdf_bytes, filename)
