"""
Skill Runtime - Progressive Disclosure for Document Generation Skills

Implements the two-layer coverage model:
- Layer 1 (Source Material): 100% vendored official files in skills/
- Layer 2 (Capability): Index + Route dispatcher

Three core tools:
1. read_skill_doc - Fragment retrieval from SKILL.md (not full text)
2. run_skill_script - Whitelisted script execution in E2B
3. list_skill_capabilities - List available skill capabilities

Hard constraints:
- Fragment retrieval max 50 lines (no full text)
- Script whitelist (only skills/**/scripts/*)
- Mandatory thread_id/user_id (no fallback)
- Output to /home/user/data/ + save_generated_file
"""

import os
import re
import hashlib
from pathlib import Path
from typing import Annotated, Any, Optional

from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig

from ..runtime_context import user_id_ctx, thread_id_ctx
from ..sandbox import execute_python
from ..storage.file_storage import save_generated_file


# =============================================================================
# Configuration
# =============================================================================

# Base path for vendored skill files
SKILLS_BASE_PATH = Path(__file__).parent.parent / "skills"

# Script whitelist - only these scripts can be executed
SCRIPT_WHITELIST = {
    # PPTX scripts
    "pptx/scripts/html2pptx.js",
    "pptx/scripts/thumbnail.py",
    "pptx/scripts/inventory.py",
    "pptx/scripts/replace.py",
    "pptx/scripts/rearrange.py",
    # XLSX scripts
    "xlsx/recalc.py",
    # DOCX scripts
    "docx/scripts/document.py",
    "docx/scripts/utilities.py",
    # PDF scripts
    "pdf/scripts/check_bounding_boxes.py",
    "pdf/scripts/fill_fillable_fields.py",
    "pdf/scripts/format_pdf_fields_output.py",
    "pdf/scripts/list_fillable_fields.py",
    "pdf/scripts/preflight.py",
    "pdf/scripts/read_pdf.py",
    "pdf/scripts/render_pdf_pages.py",
    "pdf/scripts/run_all_preflight_checks.py",
}

# Available skills
AVAILABLE_SKILLS = ["xlsx", "pptx", "docx", "pdf"]


# =============================================================================
# Context Validation
# =============================================================================

class ContextError(Exception):
    """Raised when required context (thread_id/user_id) is missing."""
    pass


class SecurityError(Exception):
    """Raised when security constraints are violated."""
    pass


def _validate_context_strict(config: RunnableConfig | None) -> tuple[str, str]:
    """
    Hard constraint: Fail if context is missing, no fallback allowed.
    
    Returns:
        Tuple of (user_id, thread_id)
    Raises:
        ContextError if user_id or thread_id cannot be resolved
    """
    user_id = None
    thread_id = None
    
    if config:
        configurable = config.get("configurable") or {}
        if isinstance(configurable, dict):
            user_id = configurable.get("user_id")
            thread_id = configurable.get("thread_id")
    
    # Fallback to ContextVar (but still validate)
    if not user_id:
        user_id = user_id_ctx.get()
    if not thread_id:
        thread_id = thread_id_ctx.get()
    
    # Hard constraint: no silent fallback
    if not user_id or user_id in ("default", "anonymous"):
        raise ContextError("Unable to identify the user. Please sign in again.")
    if not thread_id or thread_id == "default":
        raise ContextError("Unable to identify the thread. Please refresh the page.")
    
    return user_id, thread_id


# =============================================================================
# Tool 1: read_skill_doc - Fragment Retrieval
# =============================================================================

@tool
def read_skill_doc(
    skill: Annotated[str, "Skill name: xlsx, pptx, docx, pdf"],
    doc: Annotated[str, "Document name, such as 'SKILL.md', 'html2pptx.md', or 'forms.md'"] = "SKILL.md",
    section: Annotated[str, "Section heading, such as '## Creating new' or '### Workflow'"] = None,
    keyword: Annotated[str, "Search keyword"] = None,
    max_lines: Annotated[int, "Maximum number of lines to return"] = 50,
    config: RunnableConfig = None,  # type: ignore[assignment]
) -> dict[str, Any]:
    """
    Read a fragment of a Skill document without returning the full document.
    
    Use this to retrieve guidance related to a specific section or keyword.
    
    Returns:
    - source: {path, start_line, end_line, snippet_hash}
    - content: document fragment
    - truncated: whether the content was truncated
    """
    if skill not in AVAILABLE_SKILLS:
        return {
            "success": False,
            "error": f"Unknown skill: {skill}. Available: {AVAILABLE_SKILLS}"
        }
    
    doc_path = SKILLS_BASE_PATH / skill / doc
    if not doc_path.exists():
        # Try to find in subdirectories
        for subdir in ["scripts", "ooxml"]:
            alt_path = SKILLS_BASE_PATH / skill / subdir / doc
            if alt_path.exists():
                doc_path = alt_path
                break
        else:
            return {
                "success": False,
                "error": f"Document does not exist: {skill}/{doc}"
            }
    
    try:
        with open(doc_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except Exception as e:
        return {"success": False, "error": f"Read failed: {e}"}
    
    total_lines = len(lines)
    start_line = 1
    end_line = total_lines
    matched_lines = lines
    
    # Section-based extraction
    if section:
        section_start = None
        section_end = None
        section_pattern = section.lower().strip()
        
        for i, line in enumerate(lines):
            # Match heading
            if line.strip().lower().startswith(section_pattern):
                section_start = i
            elif section_start is not None and line.startswith("#") and i > section_start:
                # Next section starts
                section_end = i
                break
        
        if section_start is not None:
            start_line = section_start + 1
            end_line = section_end if section_end else min(section_start + max_lines, total_lines)
            matched_lines = lines[section_start:end_line]
    
    # Keyword-based extraction
    elif keyword:
        keyword_lower = keyword.lower()
        matching_indices = []
        
        for i, line in enumerate(lines):
            if keyword_lower in line.lower():
                # Include context: 3 lines before, 7 lines after
                start = max(0, i - 3)
                end = min(total_lines, i + 8)
                matching_indices.extend(range(start, end))
        
        if matching_indices:
            matching_indices = sorted(set(matching_indices))
            start_line = matching_indices[0] + 1
            end_line = matching_indices[-1] + 1
            matched_lines = [lines[i] for i in matching_indices]
    
    # Apply max_lines limit
    truncated = False
    if len(matched_lines) > max_lines:
        matched_lines = matched_lines[:max_lines]
        truncated = True
        end_line = start_line + max_lines - 1
    
    content = "".join(matched_lines)
    snippet_hash = hashlib.md5(content.encode()).hexdigest()[:8]
    
    return {
        "success": True,
        "source": {
            "path": str(doc_path.relative_to(SKILLS_BASE_PATH.parent)),
            "start_line": start_line,
            "end_line": end_line,
            "snippet_hash": snippet_hash
        },
        "content": content,
        "truncated": truncated,
        "total_doc_lines": total_lines
    }


# =============================================================================
# Tool 2: list_skill_capabilities - Index
# =============================================================================

@tool
def list_skill_capabilities(
    skill: Annotated[str, "Skill name: xlsx, pptx, docx, pdf"] = None,
    config: RunnableConfig = None,  # type: ignore[assignment]
) -> dict[str, Any]:
    """
    List available Skill capabilities.
    
    If skill is omitted, return an overview of all skills.
    If skill is provided, return detailed capabilities for that skill.
    """
    if skill and skill not in AVAILABLE_SKILLS:
        return {
            "success": False,
            "error": f"Unknown skill: {skill}. Available: {AVAILABLE_SKILLS}"
        }
    
    if not skill:
        # Return overview of all skills
        overview = {}
        for s in AVAILABLE_SKILLS:
            skill_path = SKILLS_BASE_PATH / s
            if skill_path.exists():
                docs = list(skill_path.glob("*.md"))
                scripts = list((skill_path / "scripts").glob("*")) if (skill_path / "scripts").exists() else []
                overview[s] = {
                    "documents": [d.name for d in docs],
                    "scripts": [sc.name for sc in scripts if sc.is_file()],
                }
        return {
            "success": True,
            "skills": overview
        }
    
    # Return detailed capabilities for specific skill
    skill_path = SKILLS_BASE_PATH / skill
    result = {
        "success": True,
        "skill": skill,
        "documents": [],
        "scripts": [],
        "workflows": []
    }
    
    # List documents
    for doc in skill_path.glob("*.md"):
        result["documents"].append({
            "name": doc.name,
            "path": str(doc.relative_to(SKILLS_BASE_PATH.parent))
        })
    
    # Check ooxml subdirectory
    ooxml_path = skill_path / "ooxml"
    if ooxml_path.exists():
        for doc in ooxml_path.glob("*.md"):
            result["documents"].append({
                "name": doc.name,
                "path": str(doc.relative_to(SKILLS_BASE_PATH.parent))
            })
    
    # List whitelisted scripts
    for script in SCRIPT_WHITELIST:
        if script.startswith(f"{skill}/"):
            script_name = script.split("/")[-1]
            result["scripts"].append({
                "name": script_name,
                "path": script,
                "executable": True
            })
    
    # Extract workflows from SKILL.md (parse ## headers)
    skill_md = skill_path / "SKILL.md"
    if skill_md.exists():
        with open(skill_md, "r") as f:
            for line in f:
                if line.startswith("## "):
                    workflow = line[3:].strip()
                    result["workflows"].append(workflow)
    
    return result


# =============================================================================
# Tool 3: run_skill_script - Whitelisted Script Execution
# =============================================================================

@tool
def run_skill_script(
    script_path: Annotated[str, "Script path, such as 'pptx/scripts/thumbnail.py'"],
    args: Annotated[list[str], "Script argument list"],
    input_files: Annotated[list[str], "Input file paths inside the sandbox"] = None,
    config: RunnableConfig = None,  # type: ignore[assignment]
) -> dict[str, Any]:
    """
    Execute a whitelisted Skill script.
    
    Execution environment: E2B sandbox.
    Output contract: generated artifacts must be written to /home/user/data/.
    
    Requires human-in-the-loop approval.
    """
    # Hard constraint: validate context
    try:
        user_id, thread_id = _validate_context_strict(config)
    except ContextError as e:
        return {"success": False, "error": str(e)}
    
    # Hard constraint: whitelist check
    if script_path not in SCRIPT_WHITELIST:
        return {
            "success": False,
            "error": f"Script is not whitelisted: {script_path}",
            "available_scripts": list(SCRIPT_WHITELIST)
        }
    
    # Resolve full script path
    full_script_path = SKILLS_BASE_PATH / script_path
    if not full_script_path.exists():
        return {
            "success": False,
            "error": f"Script file does not exist: {script_path}"
        }
    
    # Read script content
    try:
        with open(full_script_path, "r") as f:
            script_content = f.read()
    except Exception as e:
        return {"success": False, "error": f"Failed to read script: {e}"}
    
    # Determine script type
    is_python = script_path.endswith(".py")
    is_js = script_path.endswith(".js")
    
    if is_python:
        # Execute Python script in E2B
        # First, write the script to sandbox
        args_str = " ".join(f'"{arg}"' for arg in args) if args else ""
        
        code = f'''
import subprocess
import sys
import os

# Write script to sandbox
script_content = """{script_content}"""

script_path = "/home/user/data/_skill_script.py"
with open(script_path, "w") as f:
    f.write(script_content)

# Execute script
result = subprocess.run(
    [sys.executable, script_path] + {args if args else []},
    capture_output=True,
    text=True,
    cwd="/home/user/data",
    timeout=120
)

print("=== STDOUT ===")
print(result.stdout)
print("=== STDERR ===")
print(result.stderr)
print("=== RETURNCODE ===")
print(result.returncode)
'''
        
        result = execute_python(code=code, timeout=180, user_id=user_id, thread_id=thread_id)
        
    elif is_js:
        # For JS scripts, we need node
        # First check if node is available
        check_code = '''
import subprocess
result = subprocess.run(["node", "-v"], capture_output=True, text=True)
print(result.stdout.strip() if result.returncode == 0 else "NODE_NOT_FOUND")
'''
        check_result = execute_python(code=check_code, timeout=10, user_id=user_id, thread_id=thread_id)
        
        if "NODE_NOT_FOUND" in check_result.get("stdout", ""):
            return {
                "success": False,
                "error": "Node.js is not preinstalled in the E2B image, so JS scripts cannot be executed."
            }
        
        args_str = " ".join(f'"{arg}"' for arg in args) if args else ""
        
        code = f'''
import subprocess
import os

# Write script to sandbox
script_content = """{script_content}"""

script_path = "/home/user/data/_skill_script.js"
with open(script_path, "w") as f:
    f.write(script_content)

# Execute with node
result = subprocess.run(
    ["node", script_path] + {args if args else []},
    capture_output=True,
    text=True,
    cwd="/home/user/data",
    timeout=120
)

print("=== STDOUT ===")
print(result.stdout)
print("=== STDERR ===")
print(result.stderr)
print("=== RETURNCODE ===")
print(result.returncode)
'''
        
        result = execute_python(code=code, timeout=180, user_id=user_id, thread_id=thread_id)
    
    else:
        return {
            "success": False,
            "error": f"Unsupported script type: {script_path}"
        }
    
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error") or result.get("stderr", "Execution failed"),
            "stdout": result.get("stdout"),
            "stderr": result.get("stderr")
        }
    
    # Parse output
    stdout = result.get("stdout", "")
    
    # Check for generated files in sandbox
    artifacts = []
    generated_files = result.get("generated_files", [])
    for gf in generated_files:
        if gf.get("file_id"):
            artifacts.append({
                "file_id": gf["file_id"],
                "download_url": gf.get("download_url"),
                "filename": gf.get("filename"),
                "file_type": "generated"
            })
    
    return {
        "success": True,
        "script": script_path,
        "stdout": stdout,
        "stderr": result.get("stderr", ""),
        "artifacts": artifacts
    }


# =============================================================================
# Dependency Check Tool
# =============================================================================

@tool
def check_skill_dependencies(
    skill: Annotated[str, "Skill name: xlsx, pptx, docx, pdf"],
    config: RunnableConfig = None,  # type: ignore[assignment]
) -> dict[str, Any]:
    """
    Check whether the dependencies required by a Skill are preinstalled in the E2B image.
    
    Call this during startup or before using a Skill so missing dependencies fail early.
    """
    try:
        user_id, thread_id = _validate_context_strict(config)
    except ContextError as e:
        return {"success": False, "error": str(e)}
    
    checks = {
        "xlsx": [
            ("python", 'import openpyxl; print("openpyxl OK")'),
            ("python", 'import pandas; print("pandas OK")'),
        ],
        "pptx": [
            ("python", 'import pptx; print("python-pptx OK")'),
            ("node", 'console.log("node OK")'),
        ],
        "docx": [
            ("python", 'import docx; print("python-docx OK")'),
        ],
        "pdf": [
            ("python", 'import pypdf; print("pypdf OK")'),
            ("python", 'import reportlab; print("reportlab OK")'),
            ("python", 'import pdfplumber; print("pdfplumber OK")'),
        ],
    }
    
    if skill not in checks:
        return {"success": False, "error": f"Unknown skill: {skill}"}
    
    results = []
    all_ok = True
    
    for check_type, check_cmd in checks[skill]:
        if check_type == "python":
            code = f'''
try:
    {check_cmd}
except ImportError as e:
    print(f"MISSING: {{e}}")
'''
            result = execute_python(code=code, timeout=10, user_id=user_id, thread_id=thread_id)
            stdout = result.get("stdout", "")
            
            if "MISSING" in stdout:
                results.append({"check": check_cmd, "status": "missing", "output": stdout})
                all_ok = False
            elif "OK" in stdout:
                results.append({"check": check_cmd, "status": "ok"})
            else:
                results.append({"check": check_cmd, "status": "unknown", "output": stdout})
        
        elif check_type == "node":
            code = '''
import subprocess
result = subprocess.run(["node", "-v"], capture_output=True, text=True)
if result.returncode == 0:
    print(f"node OK: {result.stdout.strip()}")
else:
    print("MISSING: node")
'''
            result = execute_python(code=code, timeout=10, user_id=user_id, thread_id=thread_id)
            stdout = result.get("stdout", "")
            
            if "MISSING" in stdout:
                results.append({"check": "node", "status": "missing"})
                all_ok = False
            else:
                results.append({"check": "node", "status": "ok", "version": stdout})
    
    return {
        "success": all_ok,
        "skill": skill,
        "checks": results,
        "message": "All dependencies are installed" if all_ok else "Some dependencies are missing. Please update the E2B image."
    }


# =============================================================================
# Export
# =============================================================================

SKILL_RUNTIME_TOOLS = [
    read_skill_doc,
    list_skill_capabilities,
    run_skill_script,
    check_skill_dependencies,
]
