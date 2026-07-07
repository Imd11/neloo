"""
Neloo Agent - Core Graph Definition

This module defines the main agent graph using LangChain Deep Agents.
Compatible with LangGraph server for frontend integration.

Architecture:
- Uses create_deep_agent() for automatic TodoList planning
- FilesystemMiddleware for file operations
- SubAgentMiddleware for parallel specialized tasks
- HumanInTheLoopMiddleware for sensitive operation approval
- Custom tools: execute_python (sandbox), search_web (Tavily)
- Context Engineering: Dual-form output + file storage (Manus strategy)
- Web Development Mode: Specialized prompt for generating renderable code artifacts
"""

# Apply patches before importing other modules
from ..patches.deepseek_reasoning import apply_patch as _apply_deepseek_patch
_apply_deepseek_patch()

import os
from typing import Annotated
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from deepagents import create_deep_agent, SubAgent

from ..tools.search import internet_search
from ..tools.code_execution import execute_python_tool
from ..tools.ui_design import search_ui_design
from ..context import (
    create_dual_output,
    save_result_to_file,
    should_save_to_file,
    format_file_reference,
)
from ..storage import save_image_base64, get_image_url

from ..runtime_context import user_id_ctx as _user_id_ctx, thread_id_ctx as _thread_id_ctx
from ..sandbox import get_executor, get_e2b_backend_factory
from .integration_tools import INTEGRATION_TOOLS
from ..model_ids import PUBLIC_MODEL_IDS, public_model_id
from .persistence_middleware import MessagePersistenceMiddleware

# Document generation tools (each in separate file)
from ..tools.excel_generator import EXCEL_TOOLS
from ..tools.word_generator import WORD_TOOLS
from ..tools.pdf_generator import PDF_TOOLS
from ..tools.pptx_generator import PPTX_TOOLS

# Skill Runtime - progressive disclosure for document skills
from ..tools.skill_runtime import SKILL_RUNTIME_TOOLS

# API base URL for image serving (configurable via environment)
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:2024")

# Global executor instance for E2B backend factory
# This ensures the backend uses the same sandbox pool as execute_python tool
_SANDBOX_EXECUTOR = None

def _get_sandbox_executor():
    """Get or create the global sandbox executor."""
    global _SANDBOX_EXECUTOR
    if _SANDBOX_EXECUTOR is None:
        _SANDBOX_EXECUTOR = get_executor()
    return _SANDBOX_EXECUTOR


# =============================================================================
# Neloo - General Purpose AI Assistant System Prompt
# =============================================================================

GENERAL_ASSISTANT_PROMPT = """You are Neloo, a powerful AI assistant capable of solving complex tasks through reasoning and tool use.

## Core Capabilities

1. **Code Execution & Development**
   - Write and execute Python code for any task
   - Data analysis, automation, calculations
   - File processing and transformation

2. **Research & Analysis**
   - Search the web for information
   - Analyze data and generate insights
   - Create visualizations and reports

3. **Document Creation**
   - Write structured reports and documentation
   - Generate formatted output (Markdown, LaTeX)
   - Summarize and explain complex topics

4. **Data Analysis** (when needed)
   - Exploratory Data Analysis (EDA)

## Available Tools

1. `execute_python` - Execute Python code in a secure sandbox
   - Pre-installed: pandas, numpy, scipy, matplotlib, seaborn, requests
   - Use for calculations, data processing, visualizations, automation
   - Images are automatically captured and returned

2. `search_web` - Search the internet for information
   - Use for current events, documentation, research
   - Cite sources when providing information

3. `search_ui_design` - Query UI/UX design knowledge base
   - 57 UI styles, 95 color palettes, 56 font pairings
   - 10 tech stack guidelines (React, Next.js, Vue, etc.)
   - Use when creating UI without specified design

4. **Document Generation Tools**
   - `create_excel` - Generate Excel spreadsheets
   - `create_word` - Generate Word documents
   - `create_pptx` - Generate PowerPoint presentations
   - `create_pdf` - Generate PDF documents
   
   **IMPORTANT**: Before calling any `create_*` tool, first construct a structured JSON spec describing:
   - filename, title, sheets/slides/sections
   - content structure (rows, columns, text, images)
   Then pass the spec to the appropriate tool.

## CRITICAL: Sandbox Execution Rules

**Each `execute_python` call runs in a completely isolated environment.**

This means:
- Variables DO NOT persist between calls
- You MUST re-import libraries in EVERY code block
- You MUST re-load data files in EVERY code block that needs them

### CORRECT Pattern (Always Use This)

```python
# EVERY execute_python call must be self-contained
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# Always reload the data - variables don't persist!
df = pd.read_csv('/path/to/file.csv')

# Now do your analysis
print(df.describe())
```

### WRONG Pattern (Never Do This)

```python
# First call
df = pd.read_csv('file.csv')
```
```python
# Second call - THIS WILL FAIL!
# NameError: name 'df' is not defined
print(df.head())  # ERROR! df doesn't exist
```

### Key Rules

1. **Never assume variables exist** - Always define/load them
2. **Always import libraries** - Even if you imported them before
3. **Reload data every time** - The file path remains valid, but `df` doesn't
4. **If you get NameError** - You forgot to reload the data in this code block

## Working with Uploaded Data Files

Users can upload data files for analysis. Supported formats:
- **CSV** (.csv) - Use `pd.read_csv()`
- **Excel** (.xlsx, .xls) - Use `pd.read_excel()`
- **Stata** (.dta) - Use `pd.read_stata()`
- **SPSS** (.sav) - Use `pd.read_spss()`
- **Parquet** (.parquet) - Use `pd.read_parquet()`

When files are uploaded, you will see information in the user message like:

```
[Uploaded Data Files]
- sales_data.csv (/home/user/data/20251218_123456_abc123_sales_data.csv)
```

### CRITICAL: How to Load Uploaded Files

**ALWAYS use the EXACT path shown in parentheses.** Do not search, do not guess, do not explore.

```python
import pandas as pd

# Copy the EXACT path from [Uploaded Data Files] - character for character!
df = pd.read_csv('/home/user/data/20251218_123456_abc123_sales_data.csv')
print(df.head())
```

### What NOT to Do

**NEVER** do any of these to find data files:
- ❌ `ls`, `glob`, `os.listdir()` - will NOT reliably find uploaded files
- ❌ `read_file` tool - operates on virtual filesystem
- ❌ Search for files by partial name
- ❌ Guess or construct file paths

**If you accidentally ran `ls` and did not see the uploaded file, do NOT conclude it is missing.**
The `ls` tool and `read_file` tool do not reflect the Python sandbox filesystem.
Proceed to load the file directly in `execute_python` using the exact path from `[Uploaded Data Files]`.

**ALWAYS** do this:
- ✅ Copy the exact path from `[Uploaded Data Files]`
- ✅ Use `pd.read_csv()` directly with that path
- ✅ If file not found, ask user to re-upload

### Best Practices for Data Files

1. **Always check the file first**: Use `.head()`, `.info()`, `.describe()` before analysis
2. **Handle encoding issues**: For CSV, try `encoding='utf-8'` or `encoding='gbk'` for Chinese data
3. **Handle missing values**: Check with `.isnull().sum()` and handle appropriately
4. **Large files**: Use `nrows=1000` parameter first to preview structure

## Error Handling - NEVER Fabricate Data

If you encounter a file error (FileNotFoundError, etc.):
1. **Report the error honestly** to the user
2. **Ask the user** to re-upload the file or verify the path
3. **NEVER create fake/synthetic data** as a workaround
4. **NEVER use np.random to generate substitute data**

Creating fake data when real data fails to load is misleading and harmful.

## Context Engineering (Important!)

To handle large datasets and long analyses efficiently:

1. **Large outputs are automatically saved**: When code execution produces large output
   (>3000 chars), the system automatically saves full results to a file and returns
   a summary with the file path.

2. **File references are recoverable**: If you see `[Full output saved: /path/to/file]`,
   you can read that file later if you need the complete data.

3. **Use efficient previews**: Instead of printing entire DataFrames, use:
   - `df.head(10)` - First 10 rows
   - `df.describe()` - Statistical summary
   - `df.info()` - Column types and memory
   - `df.shape` - Dimensions only

4. **Save intermediate results**: For complex analyses, save key results to files:
   ```python
   # Save processed data
   df_clean.to_csv('/home/user/data/cleaned_data.csv', index=False)

   # Save regression results
   with open('/home/user/data/regression_results.txt', 'w') as f:
       f.write(str(model.summary()))
   ```

5. **Reference saved files**: When continuing analysis, reference saved files instead
   of re-computing:
   ```python
   # Load previously saved results
   df_clean = pd.read_csv('/home/user/data/cleaned_data.csv')
   ```

## Task Planning with write_todos

**IMPORTANT**: Always use `write_todos` to plan your work BEFORE executing any task that involves 2+ steps.

When to use write_todos:
- User asks for data analysis → Plan steps first
- User asks to create a visualization → Plan what to analyze and visualize
- User asks to build something (landing page, dashboard) → Plan the components
- Any task that requires multiple tool calls

How to use:
1. Call `write_todos` at the START of any multi-step task
2. Mark each todo as "in_progress" when you start working on it
3. Mark as "completed" when done, before moving to next step
4. This helps users see your progress and reasoning

Example:
```
User: "Analyze sales data and create a report"

Your first action should be:
write_todos([
  {"content": "Load and inspect data", "status": "in_progress"},
  {"content": "Clean and preprocess data", "status": "pending"},
  {"content": "Calculate key statistics", "status": "pending"},
  {"content": "Create visualizations", "status": "pending"},
  {"content": "Generate summary report", "status": "pending"}
])
```

## Data Analysis Guidelines

1. **Plan before executing**: Use write_todos to break down complex analyses
2. **Show your work**: Display intermediate results and explain reasoning
3. **Handle errors gracefully**: If code fails, analyze the error and retry
4. **Format output nicely**: Use clear formatting for results
5. **Generate LaTeX tables**: For regression results, provide LaTeX formatted tables

## Parallel Analysis with SubAgents (task tool)

You have access to specialized subagents for parallel data analysis. Use the `task` tool to delegate work:

### Available Subagents:
- **eda-analyst**: Exploratory Data Analysis, data profiling, missing value analysis
- **stats-analyst**: Hypothesis testing, correlation analysis, statistical inference
- **regression-analyst**: OLS, panel data (FE/RE), IV/2SLS, DID estimation
- **viz-analyst**: Creating visualizations and charts
- **general-purpose**: Generic multi-step tasks

### When to Use SubAgents:
1. **Parallel Analysis**: When analyzing multiple variables, datasets, or running multiple models
   - Example: "Analyze correlations for X, Y, Z" → Launch 3 parallel tasks
2. **Complex Multi-step Tasks**: When a task requires many steps that can be isolated
   - Example: Full EDA → delegate to eda-analyst
3. **Specialized Analysis**: When a task matches a subagent's expertise
   - Example: Regression with diagnostics → delegate to regression-analyst

### Example Usage:
```
User: "Run OLS regressions for Model A, Model B, and Model C, then compare results"

Strategy:
1. Use task tool to launch regression-analyst for Model A
2. Use task tool to launch regression-analyst for Model B
3. Use task tool to launch regression-analyst for Model C
(All three run in PARALLEL!)
4. Synthesize and compare results from all three
```

### Important Notes:
- Subagents run in isolated context - they won't pollute main conversation
- Always provide clear instructions including the exact data file path
- Subagents return a single summary - you synthesize final results
- Use subagents for complex tasks; simple operations do directly

## Code Execution Tips

When writing Python code:
- Import all required libraries at the start
- Use meaningful variable names
- Print intermediate results for verification
- Handle potential errors with try/except
- For large outputs, summarize key findings

## Displaying Visualizations to Users

**IMPORTANT**: When your code generates a figure/chart:

1. The `execute_python` tool result will contain an image URL in markdown format:
   `![Figure 1](http://localhost:2024/images/xxx?sig=xxx)`

2. **You MUST copy and include this image URL in your response text** so users can see the figure directly.
   Do NOT just say "the figure has been generated" - users cannot see figures inside the tool result box.

3. Example response after generating a visualization:
   ```
   I've created the sales trend chart:

   ![Sales Trend](http://localhost:2024/images/xxx?sig=xxx)

   Key findings from the visualization:
   - Sales increased by 25% from January to December
   - ...
   ```

4. Always copy the EXACT image URL from the tool result - do not modify or reconstruct it.
"""

# =============================================================================
# Fortune Telling Mode Prompt (Chinese Five Elements / BaZi)
# =============================================================================
# This prompt completely replaces the default prompt when the user selects the
# Chinese Five Elements / BaZi fortune-telling feature.

FORTUNE_PROMPT = """You are a professional researcher in traditional Chinese BaZi astrology.

## Professional Background

You are deeply familiar with classical Chinese astrology texts, including:
- Qiong Tong Bao Jian, San Ming Tong Hui, Di Tian Sui, Yuan Hai Zi Ping
- Qian Li Ming Gao, Xie Ji Bian Fang Shu, Guo Lao Xing Zong, Zi Ping Zhen Quan, Shen Feng Tong Kao

## Major Luck Cycle Rules

Use the traditional rule: major luck cycles are arranged by yang years and yin years. Yang heavenly stems are Jia, Bing, Wu, Geng, and Ren. Yin heavenly stems are Yi, Ding, Ji, Xin, and Gui. Men born in yang years and women born in yin years proceed forward; men born in yin years and women born in yang years proceed backward. The direction is based on the month pillar's heavenly stem and earthly branch. Before a child enters the first major luck cycle, use the month pillar as the luck cycle reference.

**Ten Heavenly Stems**: Jia, Yi, Bing, Ding, Wu, Ji, Geng, Xin, Ren, Gui
**Twelve Earthly Branches**: Zi, Chou, Yin, Mao, Chen, Si, Wu, Wei, Shen, You, Xu, Hai

## Task

Act as a professional Four Pillars / BaZi researcher. Based on the classical texts above and established BaZi practice, provide a comprehensive analysis of the user's BaZi chart:

1. **Chart Pattern Analysis**: identify the chart pattern, useful god, favorable elements, and unfavorable elements.
2. **Five Elements Balance**: analyze the strength and weakness of the five elements, including favorable and unfavorable elements.
3. **Major Luck Cycles**: arrange the major luck cycles and analyze the auspicious or challenging qualities of each cycle.
4. **Annual Luck**: analyze recent yearly fortune trends.
5. **Career**: provide career development guidance.
6. **Wealth**: analyze wealth accumulation and investment tendencies.
7. **Relationships and Marriage**: analyze relationship patterns and provide guidance.
8. **Health**: identify health tendencies and points of caution.
9. **Family Relationships**: analyze relationships with family members and close kin.

## Output Requirements

- Provide analysis with professional depth while remaining clear and easy to understand.
- When using traditional terminology, include a brief explanation.
- If the user provides past-event validation information, use it to calibrate the interpretation.
- Be honest about uncertain predictions.

## Important Disclaimer

- This is an academic discussion of traditional cultural knowledge and is for reference only.
- People retain agency over their own lives; BaZi should be treated as one reference point, not a fixed destiny.
- Major life decisions should be made by considering multiple practical factors.
"""

# =============================================================================
# Web Development Mode Prompt
# =============================================================================
# This prompt is appended when the thread is in "web-dev" mode.
# It instructs the AI to output code wrapped in <artifact> tags for frontend rendering.

WEB_DEV_PROMPT = """
## Web Development Mode

You are now in **Web Development Mode**. When the user asks you to create, modify, or build any UI component, webpage, or interactive element:

### Output Format

Always wrap your code in `<artifact>` tags with the following attributes:
- `type`: Required. One of: `react`, `html`, `vue`
- `title`: Optional. A short descriptive title for the component

### Supported Types

1. **react** (RECOMMENDED for interactive components):
   - React functional components with hooks
   - Must have a default export
   - Can use useState, useEffect, useRef, etc.
   - Tailwind CSS classes are available
   - Import React at the top

Example:
<artifact type="react" title="Counter Component">
import React, { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="p-4 text-center">
      <h1 className="text-2xl font-bold mb-4">Counter: {count}</h1>
      <button
        onClick={() => setCount(c => c + 1)}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Increment
      </button>
    </div>
  );
}
</artifact>

2. **html**: Complete HTML document with embedded CSS and JavaScript
   - MUST be a complete HTML document with <!DOCTYPE html>, <html>, <head>, and <body> tags
   - Put CSS in <style> tag inside <head>
   - Put JavaScript in <script> tag at the END of <body> (after all HTML elements)
   - If using JavaScript with getElementById, ensure the element exists in HTML

Example:
<artifact type="html" title="Shopping Cart">
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: system-ui, sans-serif; }
  </style>
</head>
<body class="p-4">
  <div id="app">
    <h1 class="text-2xl font-bold mb-4">Shopping Cart</h1>
    <div id="items"></div>
    <p id="total" class="font-bold mt-4"></p>
  </div>

  <script>
    // JavaScript runs after DOM is ready (placed at end of body)
    const items = [
      { name: 'Apple', price: 2.5 },
      { name: 'Banana', price: 1.5 }
    ];

    const itemsDiv = document.getElementById('items');
    const totalEl = document.getElementById('total');

    items.forEach(item => {
      const div = document.createElement('div');
      div.textContent = `${item.name}: $${item.price}`;
      itemsDiv.appendChild(div);
    });

    const total = items.reduce((sum, item) => sum + item.price, 0);
    totalEl.textContent = `Total: $${total.toFixed(2)}`;
  </script>
</body>
</html>
</artifact>

3. **vue**: Vue 3 Single File Components
   - Uses <script setup> syntax
   - Can use ref, reactive, computed, etc.
   - Tailwind CSS classes are available

### Guidelines

1. **Always output complete, runnable code** - no placeholders or "..."
2. **One artifact per response** unless the user asks for multiple variants
3. **Use Tailwind CSS** for styling when possible (available in the preview)
4. **For complex interactive apps, prefer React over HTML** - React is more reliable
5. **For HTML: Always use complete document structure** with proper <head> and <body>
6. **For HTML: Put <script> at END of body** so DOM elements exist when JS runs

### Professional UI/UX Design Workflow

When creating UI components, follow this systematic workflow for professional results:

#### Step 1: Analyze User Request
Extract key information from the user's request:
- **Product Type**: What is being built? (landing page, dashboard, form, etc.)
- **Target Industry**: What sector? (SaaS, fintech, healthcare, e-commerce, etc.)
- **Style Preference**: Any specific aesthetic? (minimalist, glassmorphism, etc.)
- **Target Stack**: What framework? (React, Next.js, Vue, HTML, etc.)

#### Step 2: Query Design Knowledge (search_ui_design tool)
Search in this recommended order based on what's needed:
1. `domain="product"` - Get overall recommendations for the product type
2. `domain="style"` - Get visual style guidelines and effects
3. `domain="typography"` - Get font pairings (includes Google Fonts URLs)
4. `domain="color"` - Get industry-appropriate color palettes (hex values)
5. `domain="landing"` - For landing pages, get section patterns
6. `domain="chart"` - For dashboards, get chart recommendations
7. `domain="ux"` - Get UX best practices and anti-patterns
8. `stack="react|nextjs|vue|..."` - Get framework-specific guidelines

Example queries:
- `search_ui_design("SaaS dashboard")` → product + style tokens
- `search_ui_design("fintech", domain="color")` → industry color palette
- `search_ui_design("modern professional", domain="typography")` → font pairing
- `search_ui_design("state management", stack="react")` → React best practices
- `search_ui_design("routing", stack="nextjs")` → Next.js guidelines

#### Step 3: Apply Design Tokens
Use the returned design tokens directly in your code:
- Copy hex colors: `bg-[#3B82F6]`, `text-[#1F2937]`
- Apply Google Fonts via import URL
- Use suggested Tailwind classes for shadows, borders, etc.

### Common Rules for Professional UI

**ALWAYS follow these rules for high-quality output:**

1. **Icons**: Use Lucide React icons (`lucide-react`). NEVER use emoji as icons.
   ```tsx
   import { Home, Settings, User } from 'lucide-react';
   ```

2. **Buttons**: Always add `cursor-pointer` class to all interactive elements.

3. **Contrast**: Ensure text/background contrast ratio meets WCAG 2.1 AA (4.5:1 minimum).

4. **Viewport**: Include responsive viewport meta tag in HTML:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   ```

5. **Layout**: Use CSS Grid or Flexbox. Avoid absolute positioning except for overlays.

6. **Color Usage**:
   - Primary color: CTAs, key actions, links
   - Secondary color: Supporting elements, cards
   - Background: Main surfaces (use subtle grays, not pure white)
   - Text: Use dark grays (#1F2937), not pure black

7. **Spacing**: Use consistent Tailwind spacing scale (4, 8, 12, 16, 24, 32, 48, 64px).

8. **Typography**: Limit to 2-3 font sizes per component. Use font-weight for hierarchy.

### Pre-Delivery Checklist

Before outputting any artifact, verify:

- [ ] **Visual Quality**: Clean hierarchy, professional colors, proper spacing
- [ ] **Interaction**: All buttons have hover states, clickable items have `cursor-pointer`
- [ ] **Responsive**: Works on mobile (test with narrow viewport mindset)
- [ ] **Light Mode**: Looks good with light backgrounds (default)
- [ ] **No Placeholder**: All images use real Unsplash URLs or SVG icons
- [ ] **Accessibility**: Buttons have aria-labels if icon-only, form inputs have labels

Skip the design workflow ONLY if user already provided specific colors/fonts/style.

### When NOT to Use Artifacts

- For data analysis code (use execute_python instead)
- For explanations or discussions
- For showing code snippets that aren't meant to be rendered
"""

def _resolve_thread_id_from_config(config: RunnableConfig | None) -> str | None:
    if not config:
        return None
    try:
        configurable = config.get("configurable") or {}
        if isinstance(configurable, dict):
            thread_id = configurable.get("thread_id")
            if isinstance(thread_id, str) and thread_id:
                return thread_id
    except Exception:
        return None
    return None


def _resolve_user_id_for_thread(thread_id: str) -> str | None:
    """
    Resolve authenticated user_id for a LangGraph thread_id via DB.

    Tools execute in a ThreadPoolExecutor where ContextVars may not propagate,
    so reading user_id_ctx/thread_id_ctx can fall back to "default".
    """
    if not thread_id or thread_id == "default":
        return None
    try:
        from ..storage.supabase_db import USE_SUPABASE_DB, get_thread_by_langgraph_id
        if not USE_SUPABASE_DB:
            return None

        import asyncio

        async def _get_user_id() -> str | None:
            record = await get_thread_by_langgraph_id(thread_id)
            if record and isinstance(record.get("user_id"), str):
                return record["user_id"]
            return None

        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(_get_user_id())
        else:
            return None
    except Exception as e:
        print(f"[execute_python] Warning: Failed to resolve user_id for thread {thread_id[:8]}...: {e}")
        return None


# =============================================================================
# Tool Definitions
# =============================================================================

@tool
def execute_python(
    code: Annotated[str, "Python code to execute"],
    timeout: Annotated[int, "Timeout in seconds"] = 120,
    config: RunnableConfig = None,  # type: ignore[assignment]
) -> str:
    """
    Execute Python code in a secure sandbox environment.

    The sandbox has pre-installed data science packages:
    - pandas, numpy, scipy
    - statsmodels (for regression analysis)
    - matplotlib, seaborn (for visualization)

    Returns the execution result including stdout, stderr, and any outputs.
    Images generated by matplotlib are automatically captured.

    **Context Engineering**: Large outputs are automatically compressed.
    - Full output is shown to user
    - Summary is returned for LLM context
    - If output exceeds threshold, full data is saved to file with path reference
    """
    # Resolve thread_id/user_id. Do not rely solely on ContextVars because tools
    # execute in a ThreadPoolExecutor where ContextVars may not propagate.
    thread_id = _resolve_thread_id_from_config(config) or _thread_id_ctx.get()
    user_id = _user_id_ctx.get()

    if user_id in ("default", "anonymous"):
        resolved = _resolve_user_id_for_thread(thread_id) if isinstance(thread_id, str) else None
        if resolved:
            user_id = resolved

    if user_id in ("default", "anonymous"):
        return (
            "Execution failed: missing authenticated user context.\n"
            "The server could not determine your user_id for sandbox file sync.\n"
            "Please refresh the page and sign in again."
        )

    # Ensure downstream storage + image saving sees the correct context within this tool thread.
    _user_id_ctx.set(user_id)
    if isinstance(thread_id, str) and thread_id:
        _thread_id_ctx.set(thread_id)

    result = execute_python_tool(code=code, timeout=timeout, user_id=user_id, thread_id=thread_id)

    # Try to update state.files with generated files (deepagents integration)
    try:
        if result.get("generated_files"):
            import inspect
            # Find the runtime in the call stack (deepagents pattern)
            for frame_info in inspect.stack():
                frame_locals = frame_info.frame.f_locals
                if 'runtime' in frame_locals:
                    runtime = frame_locals['runtime']
                    if hasattr(runtime, 'state'):
                        state = runtime.state
                        files = state.get("files", {})
                        # Add generated files to state
                        for gen_file in result["generated_files"]:
                            filename = gen_file.get("filename")
                            download_url = gen_file.get("download_url")
                            if filename and download_url:
                                # Store download URL as file content for frontend display
                                file_content = f"# {filename}\nDownload: {download_url}\n"
                                files[filename] = file_content
                        state["files"] = files
                        print(f"[execute_python] Updated state.files with {len(result['generated_files'])} files")
                        break
    except Exception as e:
        # Silent failure - file registration is not critical
        print(f"[execute_python] Warning: Could not update state.files: {e}")

    if result["success"]:
        output_parts = []
        full_output_parts = []  # For file storage (uncompressed)
        image_count = 0

        if result["stdout"]:
            output_parts.append(f"Output:\n{result['stdout']}")
            full_output_parts.append(f"Output:\n{result['stdout']}")

        if result["results"]:
            for r in result["results"]:
                if r["type"] == "text/plain" and r["data"] not in result.get("stdout", ""):
                    output_parts.append(f"Result: {r['data']}")
                    full_output_parts.append(f"Result: {r['data']}")
                elif r["type"] == "text/latex":
                    output_parts.append(f"LaTeX:\n{r['data']}")
                    full_output_parts.append(f"LaTeX:\n{r['data']}")
                elif r["type"] == "image/png":
                    # Save image to storage and return URL (not base64!)
                    # This prevents FilesystemMiddleware from evicting the image data
                    image_count += 1

                    # Get user_id and thread_id from context
                    user_id = _user_id_ctx.get()
                    thread_id = _thread_id_ctx.get()

                    image_info = save_image_base64(
                        r["data"],
                        thread_id=thread_id,
                        user_id=user_id
                    )

                    if image_info:
                        # Return URL for frontend to load
                        image_url = f"{API_BASE_URL}{image_info['url_path']}"
                        output_parts.append(f"![Figure {image_count}]({image_url})")
                        full_output_parts.append(f"[Figure {image_count} saved: {image_url}]")
                    else:
                        # Fallback to base64 if storage fails
                        output_parts.append(f"![Figure {image_count}](data:image/png;base64,{r['data']})")
                        full_output_parts.append(f"[Figure {image_count} - storage failed, using inline]")

        raw_output = "\n\n".join(output_parts) if output_parts else "Code executed successfully (no output)"
        full_text = "\n\n".join(full_output_parts) if full_output_parts else raw_output

        # Process generated files and add to state.files
        generated_files_info = []
        if result.get("generated_files"):
            for gen_file in result["generated_files"]:
                filename = gen_file.get("filename", "unknown")
                download_url = gen_file.get("download_url")
                file_id = gen_file.get("file_id")
                file_type = gen_file.get("file_type", "generated")

                if download_url:
                    # Build file info for state.files
                    file_content_preview = f"# Generated File: {filename}\n"
                    file_content_preview += f"Download URL: {download_url}\n"
                    if file_id:
                        file_content_preview += f"File ID: {file_id}\n"
                    file_content_preview += f"Type: {file_type}\n"
                    file_content_preview += f"\nThis file was generated during code execution."

                    generated_files_info.append({
                        "filename": filename,
                        "content": file_content_preview,
                        "download_url": download_url,
                    })

        # If we have generated files, prepend their info to output
        if generated_files_info:
            files_msg = "\n[Generated Files]\n"
            for f in generated_files_info:
                files_msg += f"- {f['filename']}: {f['download_url']}\n"
            raw_output = files_msg + "\n" + raw_output
            full_text = files_msg + "\n" + full_text

        # Apply Context Engineering: dual-form output
        # Check if output is large enough to need compression
        if should_save_to_file(full_text):
            # Save full output to file for recovery
            file_info = save_result_to_file(
                content=full_text,
                result_type="code_execution",
                metadata={"code_preview": code[:200]}
            )

            # Create dual output: summary for LLM, with file reference
            dual = create_dual_output(raw_output, output_type="auto")

            # Return summary with file reference
            return (
                f"{dual.summary_output}\n\n"
                f"[Full output saved: {file_info['file_path']}]\n"
                f"[Size: {file_info['size']} chars]"
            )
        else:
            # Output is small enough, return as-is
            return raw_output
    else:
        error_msg = result.get("error", "Unknown error")
        stderr = result.get("stderr", "")
        return f"Execution failed:\n{error_msg}\n{stderr}"


@tool
def search_web(
    query: Annotated[str, "Search query"],
    max_results: Annotated[int, "Maximum results to return"] = 5,
) -> str:
    """
    Search the internet for information.

    Use this tool to find:
    - Documentation and tutorials
    - Code examples
    - Domain-specific knowledge
    - Recent news and updates
    """
    result = internet_search(query=query, max_results=max_results)

    if "error" in result and result["error"]:
        return f"Search error: {result['error']}"

    if not result.get("results"):
        return "No results found"

    output_parts = []
    for i, item in enumerate(result["results"], 1):
        title = item.get("title", "No title")
        url = item.get("url", "")
        snippet = item.get("content", item.get("snippet", ""))
        output_parts.append(f"{i}. **{title}**\n   URL: {url}\n   {snippet[:200]}...")

    return "\n\n".join(output_parts)


# Custom tools for the Neloo agent
# INTEGRATION_TOOLS provides runtime dispatcher for third-party apps (Composio)
# Document tools: Excel, Word, PDF, PowerPoint (each in separate file)
# SKILL_RUNTIME_TOOLS: Progressive disclosure for document skills
CUSTOM_TOOLS = (
    [execute_python, search_web, search_ui_design]
    + INTEGRATION_TOOLS
    + EXCEL_TOOLS
    + WORD_TOOLS
    + PDF_TOOLS
    + PPTX_TOOLS
    + SKILL_RUNTIME_TOOLS
)


# =============================================================================
# SubAgent Definitions for Parallel Specialized Work
# =============================================================================

# EDA (Exploratory Data Analysis) SubAgent
EDA_SUBAGENT: SubAgent = {
    "name": "eda-analyst",
    "description": "Specialized agent for Exploratory Data Analysis (EDA). Use this agent when you need to perform data cleaning, descriptive statistics, data profiling, missing value analysis, or initial data exploration. Great for parallelizing EDA tasks across multiple datasets or variables.",
    "system_prompt": """You are an EDA (Exploratory Data Analysis) specialist. Your task is to:

1. **Data Profiling**: Analyze data types, distributions, and basic statistics
2. **Missing Value Analysis**: Identify and report missing data patterns
3. **Outlier Detection**: Find potential outliers using statistical methods
4. **Data Quality Assessment**: Check for duplicates, inconsistencies, and data issues

Always use execute_python to run analysis code. Remember:
- Re-import libraries and reload data in EVERY code block
- Use the exact file path provided
- Print clear, formatted results
- Save large outputs to files

Return a concise summary of your findings, including:
- Data shape and types
- Key statistics
- Data quality issues found
- Recommendations for data cleaning
""",
    "tools": CUSTOM_TOOLS,
}

# Statistical Analysis SubAgent
STATS_SUBAGENT: SubAgent = {
    "name": "stats-analyst",
    "description": "Specialized agent for statistical analysis. Use this agent for hypothesis testing (t-tests, chi-square, ANOVA), correlation analysis, statistical modeling, and significance testing. Ideal for parallelizing multiple statistical tests.",
    "system_prompt": """You are a Statistical Analysis specialist. Your task is to:

1. **Hypothesis Testing**: Conduct t-tests, chi-square tests, ANOVA, etc.
2. **Correlation Analysis**: Calculate and interpret correlation coefficients
3. **Distribution Analysis**: Test for normality, fit distributions
4. **Statistical Inference**: Compute confidence intervals, p-values

Always use execute_python to run analysis code. Remember:
- Re-import libraries (scipy, statsmodels, pandas) in EVERY code block
- Reload data using the exact file path provided
- Report test statistics, p-values, and effect sizes
- Interpret results in plain language

Return a structured report including:
- Test name and hypotheses
- Test statistics and p-values
- Effect sizes when applicable
- Clear interpretation of results
""",
    "tools": CUSTOM_TOOLS,
}

# Regression Analysis SubAgent
REGRESSION_SUBAGENT: SubAgent = {
    "name": "regression-analyst",
    "description": "Specialized agent for regression and econometric analysis. Use this agent for OLS regression, panel data analysis (Fixed Effects, Random Effects), instrumental variables (IV/2SLS), and Difference-in-Differences (DID). Perfect for running multiple regression specifications in parallel.",
    "system_prompt": """You are an Econometric/Regression Analysis specialist. Your task is to:

1. **OLS Regression**: Estimate linear models with proper diagnostics
2. **Panel Data**: Fixed Effects, Random Effects, Hausman tests
3. **Causal Inference**: DID, IV/2SLS estimation
4. **Diagnostics**: Heteroskedasticity, multicollinearity, autocorrelation

Always use execute_python to run analysis code. Remember:
- Re-import libraries (statsmodels, linearmodels) in EVERY code block
- Reload data using the exact file path provided
- Include robust standard errors when appropriate
- Generate LaTeX tables for publication

Return a structured report including:
- Model specification
- Coefficient estimates with standard errors
- R-squared and model fit statistics
- Diagnostic test results
- LaTeX formatted tables
""",
    "tools": CUSTOM_TOOLS,
}

# Visualization SubAgent
VISUALIZATION_SUBAGENT: SubAgent = {
    "name": "viz-analyst",
    "description": "Specialized agent for data visualization. Use this agent when you need to create charts, plots, and visual representations of data. Excellent for parallelizing the creation of multiple visualizations.",
    "system_prompt": """You are a Data Visualization specialist. Your task is to:

1. **Distribution Plots**: Histograms, density plots, box plots
2. **Relationship Plots**: Scatter plots, correlation heatmaps
3. **Time Series**: Line charts, trend visualizations
4. **Comparison Plots**: Bar charts, grouped comparisons

Always use execute_python to run visualization code. Remember:
- Re-import libraries (matplotlib, seaborn) in EVERY code block
- Reload data using the exact file path provided
- Use plt.show() to display figures
- Create clear, labeled, publication-quality plots

Return a summary of visualizations created, including:
- What each plot shows
- Key insights from the visuals
- Any notable patterns or anomalies observed
""",
    "tools": CUSTOM_TOOLS,
}

# List of all custom subagents
DATA_ANALYST_SUBAGENTS: list[SubAgent] = [
    EDA_SUBAGENT,
    STATS_SUBAGENT,
    REGRESSION_SUBAGENT,
    VISUALIZATION_SUBAGENT,
]


# =============================================================================
# Human-in-the-Loop Configuration for Sensitive Operations
# =============================================================================

# Define which operations require human approval
# This integrates with LangGraph's interrupt mechanism
INTERRUPT_ON_CONFIG = {
    # Code execution - requires approval for potentially dangerous operations
    "execute_python": {
        "before": True,  # Interrupt before execution
        "description": "Python code execution in sandbox",
    },
    # Skill script execution - whitelisted but still requires approval
    "run_skill_script": {
        "before": True,
        "description": "Skill script execution in sandbox",
    },
    # File operations that modify data
    "write_file": {
        "before": True,
        "description": "Writing to files",
    },
    "edit_file": {
        "before": True,
        "description": "Editing existing files",
    },
}

# Environment variable to control HITL behavior
# Set ENABLE_HITL=true to enable human-in-the-loop approval
ENABLE_HITL = os.environ.get("ENABLE_HITL", "false").lower() == "true"


# =============================================================================
# Model Selection
# =============================================================================

# Model context window sizes (adjusted for LangChain's token counting)
#
# IMPORTANT: LangChain uses 4 chars/token for non-Anthropic models, but DeepSeek
# actually uses ~2.5 chars/token. This means LangChain UNDERESTIMATES token count.
#
# For DeepSeek (131K actual limit):
#   - At 131K real tokens, LangChain thinks it's only ~82K tokens
#   - We set max_input_tokens to 80K so trigger fires at 68K "LangChain tokens"
#   - 68K * 4 chars = 272K chars, which is ~109K real DeepSeek tokens (safe!)
#
MODEL_PROFILES = {
    "deepseek": {"max_input_tokens": 80000},      # Adjusted for LangChain's 4 chars/token counting
    "anthropic": {"max_input_tokens": 180000},    # Claude: 200k context, leave buffer
    "openai": {"max_input_tokens": 120000},       # GPT-4o: 128k context, leave buffer
    "qwen": {"max_input_tokens": 120000},         # Qwen: 128k context, leave buffer
    "minimax": {"max_input_tokens": 80000},       # MiniMax: estimate based on typical limits
    "openrouter": {"max_input_tokens": 900000},   # Meta Llama via OpenRouter; keep a conservative high ceiling
    "zhipu": {"max_input_tokens": 120000},        # GLM-4: 128k context, leave buffer
    "google": {"max_input_tokens": 900000},       # Gemini: 1M context, leave buffer
}

# =============================================================================
# Model Configuration Registry
# =============================================================================
# Each model entry defines how to initialize it with init_chat_model
# Keys: model_id (used in API), display_name, model_name, provider, env_key, base_url_env, profile_key
AVAILABLE_MODELS = {
    # Public canonical model slots. These are the only chat models shown in the
    # top-left selector; users choose the concrete model with *_MODEL env vars.
    "deepseek": {
        "display_name": "DeepSeek V4 Pro",
        "model_name": "deepseek-chat",
        "model_env": "DEEPSEEK_MODEL",
        "provider": "deepseek",
        "env_key": "DEEPSEEK_API_KEY",
        "base_url_env": None,
        "profile_key": "deepseek",
    },
    "qwen": {
        "display_name": "Qwen3 Max",
        "model_name": "qwen3-max",
        "model_env": "QWEN_MODEL",
        "provider": "openai",
        "env_key": "QWEN_API_KEY",
        "base_url_env": "QWEN_BASE_URL",
        "requires_base_url": True,
        "profile_key": "qwen",
    },
    "minimax": {
        "display_name": "MiniMax M2.1",
        "model_name": "MiniMax-M2.1",
        "model_env": "MINIMAX_MODEL",
        "provider": "anthropic",
        "env_key": "MINIMAX_API_KEY",
        "base_url_env": "MINIMAX_ANTHROPIC_BASE_URL",
        "requires_base_url": True,
        "profile_key": "minimax",
    },
    "anthropic": {
        "display_name": "Claude Opus 4.8",
        "model_name": "claude-opus-4-8",
        "model_env": "ANTHROPIC_MODEL",
        "provider": "anthropic",
        "credentials": [
            {"env_key": "ANTHROPIC_API_KEY", "base_url_env": "ANTHROPIC_BASE_URL"},
            {"env_key": "NEWAPI_API_KEY", "base_url_env": "NEWAPI_ANTHROPIC_BASE_URL", "requires_base_url": True},
        ],
        "profile_key": "anthropic",
    },
    "openai": {
        "display_name": "GPT-5.5",
        "model_name": "gpt-5.5",
        "model_env": "OPENAI_MODEL",
        "provider": "openai",
        "credentials": [
            {"env_key": "OPENAI_API_KEY", "base_url_env": "OPENAI_BASE_URL"},
        ],
        "profile_key": "openai",
    },
    "gemini": {
        "display_name": "Gemini 3 Pro",
        "model_name": "gemini-3-pro-preview",
        "model_env": "GEMINI_MODEL",
        "provider": "openai",
        "credentials": [
            {"env_key": "GEMINI_API_KEY", "base_url_env": "GEMINI_BASE_URL", "requires_base_url": True},
        ],
        "profile_key": "google",
    },
    "zhipu": {
        "display_name": "GLM-4.7",
        "model_name": "glm-4.7",
        "model_env": "ZHIPU_MODEL",
        "provider": "openai",
        "env_key": "ZHIPU_API_KEY",
        "base_url_env": "ZHIPU_BASE_URL",
        "requires_base_url": True,
        "profile_key": "zhipu",
    },
    "openrouter": {
        "display_name": "Llama 4 Maverick",
        "model_name": "meta-llama/llama-4-maverick",
        "model_env": "OPENROUTER_MODEL",
        "provider": "openai",
        "env_key": "OPENROUTER_API_KEY",
        "base_url_env": "OPENROUTER_BASE_URL",
        "requires_base_url": True,
        "profile_key": "openrouter",
    },
    "custom-openai": {
        "display_name": "Custom OpenAI-compatible",
        "model_env": "CUSTOM_OPENAI_MODEL",
        "provider": "openai",
        "env_key": "CUSTOM_OPENAI_API_KEY",
        "base_url_env": "CUSTOM_OPENAI_BASE_URL",
        "requires_base_url": True,
        "requires_model_env": True,
        "profile_key": "openai",
    },
    "custom-anthropic": {
        "display_name": "Custom Anthropic-compatible",
        "model_env": "CUSTOM_ANTHROPIC_MODEL",
        "provider": "anthropic",
        "env_key": "CUSTOM_ANTHROPIC_API_KEY",
        "base_url_env": "CUSTOM_ANTHROPIC_BASE_URL",
        "requires_base_url": True,
        "requires_model_env": True,
        "profile_key": "anthropic",
    },

    # Hidden legacy IDs. They are intentionally kept for existing deployments,
    # stored thread model_id values, and historical LangGraph graph IDs.
    "deepseek-chat": {
        "display_name": "DeepSeek V3.2",
        "model_name": "deepseek-chat",
        "provider": "deepseek",
        "env_key": "DEEPSEEK_API_KEY",
        "base_url_env": None,
        "profile_key": "deepseek",
    },
    "deepseek-reasoner": {
        "display_name": "DeepSeek V3.2 (Reasoning)",
        "model_name": "deepseek-reasoner",
        "provider": "deepseek",
        "env_key": "DEEPSEEK_API_KEY",
        "base_url_env": None,
        "profile_key": "deepseek",
    },
    "qwen-plus": {
        "display_name": "Qwen Plus",
        "model_name": "qwen-plus",
        "provider": "openai",  # Uses OpenAI-compatible mode
        "env_key": "QWEN_API_KEY",
        "base_url_env": "QWEN_BASE_URL",
        "profile_key": "qwen",
    },
    "qwen3-max": {
        "display_name": "Qwen3 Max",
        "model_name": "qwen3-max",
        "provider": "openai",  # Uses OpenAI-compatible mode
        "env_key": "QWEN_API_KEY",
        "base_url_env": "QWEN_BASE_URL",
        "profile_key": "qwen",
    },
    "minimax-m2": {
        "display_name": "MiniMax M2.1",
        "model_name": "MiniMax-M2.1",
        "provider": "anthropic",  # Uses Anthropic-compatible API for thinking support
        "env_key": "MINIMAX_API_KEY",
        "base_url_env": "MINIMAX_ANTHROPIC_BASE_URL",
        "profile_key": "minimax",
    },
    "claude-opus-or": {
        "display_name": "Claude Opus 4.5 (OR)",
        "model_name": "anthropic/claude-opus-4.5",
        "provider": "openai",  # OpenRouter uses OpenAI-compatible API
        "env_key": "OPENROUTER_API_KEY",
        "base_url_env": "OPENROUTER_BASE_URL",
        "profile_key": "openrouter",
    },
    "glm-4.7": {
        "display_name": "GLM-4.7",
        "model_name": "glm-4.7",
        "provider": "openai",  # Zhipu uses OpenAI-compatible API
        "env_key": "ZHIPU_API_KEY",
        "base_url_env": "ZHIPU_BASE_URL",
        "profile_key": "zhipu",
    },
    "claude-opus-right": {
        "display_name": "Claude Opus 4.5",
        "model_name": "claude-opus-4-5-20251101",
        "provider": "openai",  # Right Code uses OpenAI-compatible API
        "env_key": "NEWAPI_API_KEY",
        "base_url_env": "NEWAPI_BASE_URL",
        "profile_key": "anthropic",
    },
    "claude-opus-right-thinking": {
        "display_name": "Claude Opus 4.5 thinking",
        "model_name": "claude-opus-4-5-20251101-thinking",
        "provider": "anthropic",  # Use native Anthropic API for thinking mode
        "env_key": "NEWAPI_API_KEY",
        "base_url_env": "NEWAPI_ANTHROPIC_BASE_URL",  # Anthropic-compatible endpoint
        "profile_key": "anthropic",
    },
    "claude-sonnet-right": {
        "display_name": "Claude Sonnet 4.5",
        "model_name": "claude-sonnet-4-5-20250929",
        "provider": "openai",  # Right Code uses OpenAI-compatible API
        "env_key": "NEWAPI_API_KEY",
        "base_url_env": "NEWAPI_BASE_URL",
        "profile_key": "anthropic",
    },
    "claude-sonnet-right-thinking": {
        "display_name": "Claude Sonnet 4.5 thinking",
        "model_name": "claude-sonnet-4-5-20250929-thinking",
        "provider": "anthropic",  # Use native Anthropic API for thinking mode
        "env_key": "NEWAPI_API_KEY",
        "base_url_env": "NEWAPI_ANTHROPIC_BASE_URL",  # Anthropic-compatible endpoint
        "profile_key": "anthropic",
    },
    "llama-4-maverick": {
        "display_name": "Llama 4 Maverick",
        "model_name": "meta-llama/llama-4-maverick",
        "provider": "openai",  # OpenRouter uses OpenAI-compatible API
        "env_key": "OPENROUTER_API_KEY",
        "base_url_env": "OPENROUTER_BASE_URL",
        "profile_key": "openrouter",
    },
    "llama-3.3-70b": {
        "display_name": "Llama 3.3",
        "model_name": "meta-llama/llama-3.3-70b-instruct",
        "provider": "openai",  # OpenRouter uses OpenAI-compatible API
        "env_key": "OPENROUTER_API_KEY",
        "base_url_env": "OPENROUTER_BASE_URL",
        "profile_key": "openrouter",
    },
}


def _env_names(value) -> list[str]:
    if not value:
        return []
    if isinstance(value, str):
        return [value]
    return list(value)


PLACEHOLDER_ENV_VALUES = {
    "changeme",
    "change-me",
    "demo",
    "example",
    "fake",
    "none",
    "null",
    "placeholder",
    "replace-me",
    "replace_me",
    "test",
    "todo",
    "xxx",
    "xxxx",
    "your-api-key",
    "your-key",
    "your-service-role-key",
    "your-supabase-anon-key",
}


def _looks_like_placeholder(value: str | None) -> bool:
    if value is None:
        return True
    normalized = value.strip().lower()
    if not normalized:
        return True
    if normalized in PLACEHOLDER_ENV_VALUES:
        return True
    if normalized.startswith(("your-", "your_", "replace-", "replace_")):
        return True
    if normalized.startswith(("sk-your", "pk-your")):
        return True
    return "<" in normalized or ">" in normalized


def _env_first(value) -> str | None:
    for name in _env_names(value):
        env_value = os.environ.get(name)
        if env_value and not _looks_like_placeholder(env_value):
            return env_value
    return None


def _resolve_model_name(config: dict) -> str | None:
    model_name = _env_first(config.get("model_env")) or config.get("model_name")
    if config.get("requires_model_env") and not _env_first(config.get("model_env")):
        return None
    return model_name


def _resolve_credentials(config: dict) -> tuple[str | None, str | None, str | None]:
    credential_options = config.get("credentials")
    if credential_options:
        for option in credential_options:
            api_key = os.environ.get(option["env_key"])
            if not api_key:
                continue
            base_url = _env_first(option.get("base_url_env"))
            if option.get("requires_base_url") and not base_url:
                continue
            return api_key, base_url, option["env_key"]
        return None, None, None

    api_key = _env_first(config.get("env_key"))
    if not api_key:
        return None, None, None

    base_url = _env_first(config.get("base_url_env"))
    if config.get("requires_base_url") and not base_url:
        return None, None, None

    env_key = _env_names(config.get("env_key"))[0] if _env_names(config.get("env_key")) else None
    return api_key, base_url, env_key


def _is_model_configured(config: dict) -> bool:
    model_name = _resolve_model_name(config)
    api_key, _base_url, _env_key = _resolve_credentials(config)
    return bool(model_name and api_key)


def _credential_env_label(config: dict) -> str:
    if config.get("credentials"):
        return ", ".join(option["env_key"] for option in config["credentials"])
    return ", ".join(_env_names(config.get("env_key")))


def get_available_models() -> list[dict]:
    """
    Get the public model registry for frontend display.

    The `available` flag tells the UI whether the required API key is configured.
    """
    models = []
    for model_id in PUBLIC_MODEL_IDS:
        config = AVAILABLE_MODELS[model_id]
        models.append({
            "id": model_id,
            "display_name": config["display_name"],
            "available": _is_model_configured(config),
        })
    return models


def get_default_model_id() -> str | None:
    """
    Get the default model ID based on available API keys.
    Priority follows the public model selector order.
    """
    for model_id in PUBLIC_MODEL_IDS:
        config = AVAILABLE_MODELS.get(model_id)
        if config and _is_model_configured(config):
            return model_id
    return None


# Every chat-model provider key the registry knows how to read. Surfaced in
# the no-key error so users see the full menu, not just four examples.
_SUPPORTED_PROVIDER_KEY_VARS = (
    "DEEPSEEK_API_KEY",
    "QWEN_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "MINIMAX_API_KEY",
    "ZHIPU_API_KEY",
    "OPENROUTER_API_KEY",
    "CUSTOM_OPENAI_API_KEY",
    "CUSTOM_ANTHROPIC_API_KEY",
)


def get_model(model_id: str | None = None):
    """
    Initialize the language model.

    Args:
        model_id: Specific model to use (e.g., "deepseek", "qwen").
                  If None, uses default based on available API keys.

    IMPORTANT: Sets model.profile for SummarizationMiddleware to work correctly.
    Without profile, the middleware falls back to 170k token threshold which
    exceeds DeepSeek's 64k context window, causing context overflow.
    """
    from langchain.chat_models import init_chat_model

    # If no model_id specified, use default
    if not model_id:
        model_id = get_default_model_id()

    if not model_id:
        raise ValueError(
            "No LLM provider key configured. Set at least one of: "
            + ", ".join(_SUPPORTED_PROVIDER_KEY_VARS)
            + ". See backend/.env.example."
        )

    # Get model configuration
    config = AVAILABLE_MODELS.get(model_id)
    if not config:
        normalized_model_id = public_model_id(model_id)
        config = AVAILABLE_MODELS.get(normalized_model_id)
        model_id = normalized_model_id or model_id

    if not config:
        raise ValueError(f"Unknown model: {model_id}. Available: {list(AVAILABLE_MODELS.keys())}")

    # Check API key is available
    api_key, base_url, _used_env_key = _resolve_credentials(config)
    if not api_key:
        raise ValueError(
            f"API key not configured for {model_id}. Set one of: {_credential_env_label(config)}"
        )

    model_name = _resolve_model_name(config)
    if not model_name:
        model_env_names = ", ".join(_env_names(config.get("model_env")))
        raise ValueError(f"Model name not configured for {model_id}. Set {model_env_names}")

    # Build init_chat_model kwargs
    kwargs = {
        "model_provider": config["provider"],
        "api_key": api_key,
        "timeout": 600,  # 10 minutes for complex data analysis
        "max_retries": 2,
    }

    # Add base_url if configured
    if base_url:
        kwargs["base_url"] = base_url

    # Initialize model
    model = init_chat_model(model_name, **kwargs)

    # CRITICAL: Set profile for SummarizationMiddleware
    model.profile = MODEL_PROFILES[config["profile_key"]]

    return model


# =============================================================================
# Create Deep Agent
# =============================================================================

def build_graph(model_id: str | None = None, mode: str = "default"):
    """
    Build the Neloo agent using Deep Agents architecture.

    Args:
        model_id: Specific model to use (e.g., "deepseek-chat", "qwen-plus").
                  If None, uses default based on available API keys.
        mode: Agent mode. Options:
              - "default": Standard general-purpose assistant mode
              - "web-dev": Web development mode with artifact output

    This provides:
    - TodoListMiddleware: Automatic task planning with write_todos tool
    - FilesystemMiddleware: File operations routed to E2B sandbox (unified filesystem)
    - SubAgentMiddleware: Parallel specialized work with subagents
      - eda-analyst: Exploratory Data Analysis
      - stats-analyst: Statistical hypothesis testing
      - regression-analyst: Econometric/regression analysis
      - viz-analyst: Data visualization
      - general-purpose: Generic task delegation
    - HumanInTheLoopMiddleware: Approval for sensitive operations (optional)
    - Custom tools: execute_python, search_web

    Environment Variables:
    - ENABLE_HITL: Set to "true" to enable human approval for sensitive operations
    - SANDBOX_MODE: "e2b" (default), "local", or "docker"

    Note: When SANDBOX_MODE=e2b, Agent's write_file operations go to E2B sandbox,
    ensuring a unified filesystem with execute_python. Files are automatically
    synced to Supabase Storage for persistence beyond sandbox timeout.
    """
    model = get_model(model_id)

    # Build system prompt based on mode
    system_prompt = GENERAL_ASSISTANT_PROMPT
    if mode == "web-dev":
        system_prompt = GENERAL_ASSISTANT_PROMPT + "\n\n" + WEB_DEV_PROMPT
    elif mode == "fortune":
        system_prompt = FORTUNE_PROMPT  # Complete replacement for fortune telling

    # Determine interrupt_on config based on ENABLE_HITL environment variable
    interrupt_on = INTERRUPT_ON_CONFIG if ENABLE_HITL else None

    # Create E2B backend factory for unified filesystem
    # This routes write_file/read_file to E2B sandbox instead of LangGraph state
    executor = _get_sandbox_executor()
    backend_factory = get_e2b_backend_factory(executor)

    # Use CUSTOM_TOOLS which now includes INTEGRATION_TOOLS
    # (Runtime Dispatcher pattern - no dynamic injection needed)
    tools = list(CUSTOM_TOOLS)
    middleware = [MessagePersistenceMiddleware()]
    
    return create_deep_agent(
        model=model,
        tools=tools,
        middleware=middleware,
        system_prompt=system_prompt,
        subagents=DATA_ANALYST_SUBAGENTS,  # Enable specialized subagents
        interrupt_on=interrupt_on,          # Enable HITL if configured
        backend=backend_factory,            # Route filesystem ops to E2B sandbox
    )


# =============================================================================
# Export Graphs for LangGraph Server
# =============================================================================

# Build graphs for each available model
# LangGraph Server will expose these as separate assistants
def _build_model_graphs() -> dict:
    """
    Build graphs for each available model, including web-dev and fortune variants.

    Returns a dict mapping model_id to compiled graph.
    Only builds graphs for models with configured API keys.

    For each model, we build:
    - {model_id}: Default mode graph
    - {model_id}-web-dev: Web development mode graph with artifact output
    - {model_id}-fortune: Fortune telling mode graph (Chinese Five Elements / BaZi)
    """
    graphs = {}
    for model_id in AVAILABLE_MODELS.keys():
        config = AVAILABLE_MODELS[model_id]
        if _is_model_configured(config):
            try:
                # Build default mode graph
                graphs[model_id] = build_graph(model_id, mode="default")
                print(f"[graph.py] Built graph for model: {model_id}")

                # Build web-dev mode graph
                webdev_id = f"{model_id}-web-dev"
                graphs[webdev_id] = build_graph(model_id, mode="web-dev")
                print(f"[graph.py] Built graph for model: {webdev_id}")

                # Build fortune mode graph (Chinese Five Elements / BaZi)
                fortune_id = f"{model_id}-fortune"
                graphs[fortune_id] = build_graph(model_id, mode="fortune")
                print(f"[graph.py] Built graph for model: {fortune_id}")
            except Exception as e:
                print(f"[graph.py] Failed to build graph for {model_id}: {e}")
    return graphs


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


# Building every configured model graph is expensive during local startup.
# Keep local dev focused on the default assistant unless explicitly requested.
BUILD_ALL_MODEL_GRAPHS = _env_flag("NELOO_BUILD_ALL_MODEL_GRAPHS")
BUILD_VARIANT_GRAPHS = _env_flag("NELOO_BUILD_VARIANT_GRAPHS", BUILD_ALL_MODEL_GRAPHS)

# Build all available model graphs only when requested.
_MODEL_GRAPHS = _build_model_graphs() if BUILD_ALL_MODEL_GRAPHS else {}

# Default graph (for backwards compatibility with LangGraph Server)
# Uses the default model based on priority.
try:
    graph = _MODEL_GRAPHS.get(get_default_model_id()) or build_graph()
except Exception as _e:
    # No provider key configured (or another build error). LangGraph needs a
    # graph object at import, so we cannot fully boot keyless — but print a
    # clear, actionable banner instead of letting a raw traceback fly.
    print("\n" + "=" * 72)
    print("Neloo backend: cannot build the default chat graph.")
    print("Most likely no chat-model provider key is configured. Set at least one of:")
    print("  " + ", ".join(_SUPPORTED_PROVIDER_KEY_VARS))
    print("Copy backend/.env.example -> backend/.env and fill in a key, then restart.")
    print(f"Original error: {_e}")
    print("=" * 72 + "\n")
    raise

# Data Analyst mode variants (for when baseId is "data_analyst").
# In fast local dev mode, alias variants to the default graph so LangGraph can
# load every configured graph id without paying the full build cost.
graph_data_analyst_webdev = build_graph(mode="web-dev") if BUILD_VARIANT_GRAPHS else graph
graph_data_analyst_fortune = build_graph(mode="fortune") if BUILD_VARIANT_GRAPHS else graph

def _graph_or_default(model_id: str):
    if model_id in _MODEL_GRAPHS:
        return _MODEL_GRAPHS[model_id]
    if model_id == get_default_model_id():
        return graph
    if model_id in PUBLIC_MODEL_IDS and _is_model_configured(AVAILABLE_MODELS[model_id]):
        try:
            return build_graph(model_id)
        except Exception as e:
            print(f"[graph.py] Failed to build public graph for {model_id}: {e}")
    return graph


def _graph_variant_or_default(model_id: str, suffix: str, fallback):
    graph_id = f"{model_id}{suffix}"
    if graph_id in _MODEL_GRAPHS:
        return _MODEL_GRAPHS[graph_id]
    if (
        BUILD_VARIANT_GRAPHS
        and model_id in PUBLIC_MODEL_IDS
        and _is_model_configured(AVAILABLE_MODELS[model_id])
    ):
        mode = suffix.removeprefix("-")
        try:
            return build_graph(model_id, mode=mode)
        except Exception as e:
            print(f"[graph.py] Failed to build public graph for {graph_id}: {e}")
    return fallback


# Public canonical model graphs
graph_deepseek = _graph_or_default("deepseek")
graph_qwen = _graph_or_default("qwen")
graph_minimax = _graph_or_default("minimax")
graph_anthropic = _graph_or_default("anthropic")
graph_openai = _graph_or_default("openai")
graph_gemini = _graph_or_default("gemini")
graph_zhipu = _graph_or_default("zhipu")
graph_openrouter = _graph_or_default("openrouter")
graph_custom_openai = _graph_or_default("custom-openai")
graph_custom_anthropic = _graph_or_default("custom-anthropic")

graph_deepseek_webdev = _graph_variant_or_default("deepseek", "-web-dev", graph_data_analyst_webdev)
graph_qwen_webdev = _graph_variant_or_default("qwen", "-web-dev", graph_data_analyst_webdev)
graph_minimax_webdev = _graph_variant_or_default("minimax", "-web-dev", graph_data_analyst_webdev)
graph_anthropic_webdev = _graph_variant_or_default("anthropic", "-web-dev", graph_data_analyst_webdev)
graph_openai_webdev = _graph_variant_or_default("openai", "-web-dev", graph_data_analyst_webdev)
graph_gemini_webdev = _graph_variant_or_default("gemini", "-web-dev", graph_data_analyst_webdev)
graph_zhipu_webdev = _graph_variant_or_default("zhipu", "-web-dev", graph_data_analyst_webdev)
graph_openrouter_webdev = _graph_variant_or_default("openrouter", "-web-dev", graph_data_analyst_webdev)
graph_custom_openai_webdev = _graph_variant_or_default("custom-openai", "-web-dev", graph_data_analyst_webdev)
graph_custom_anthropic_webdev = _graph_variant_or_default("custom-anthropic", "-web-dev", graph_data_analyst_webdev)

graph_deepseek_fortune = _graph_variant_or_default("deepseek", "-fortune", graph_data_analyst_fortune)
graph_qwen_fortune = _graph_variant_or_default("qwen", "-fortune", graph_data_analyst_fortune)
graph_minimax_fortune = _graph_variant_or_default("minimax", "-fortune", graph_data_analyst_fortune)
graph_anthropic_fortune = _graph_variant_or_default("anthropic", "-fortune", graph_data_analyst_fortune)
graph_openai_fortune = _graph_variant_or_default("openai", "-fortune", graph_data_analyst_fortune)
graph_gemini_fortune = _graph_variant_or_default("gemini", "-fortune", graph_data_analyst_fortune)
graph_zhipu_fortune = _graph_variant_or_default("zhipu", "-fortune", graph_data_analyst_fortune)
graph_openrouter_fortune = _graph_variant_or_default("openrouter", "-fortune", graph_data_analyst_fortune)
graph_custom_openai_fortune = _graph_variant_or_default("custom-openai", "-fortune", graph_data_analyst_fortune)
graph_custom_anthropic_fortune = _graph_variant_or_default("custom-anthropic", "-fortune", graph_data_analyst_fortune)

# Export individual graphs for LangGraph Server multi-assistant setup
# Default mode graphs
graph_deepseek_chat = _MODEL_GRAPHS.get("deepseek-chat") or graph_deepseek
graph_deepseek_reasoner = _MODEL_GRAPHS.get("deepseek-reasoner") or graph_deepseek
graph_qwen_plus = _MODEL_GRAPHS.get("qwen-plus") or graph_qwen
graph_qwen3_max = _MODEL_GRAPHS.get("qwen3-max") or graph_qwen
graph_minimax_m2 = _MODEL_GRAPHS.get("minimax-m2") or graph_minimax
graph_claude_opus_or = _MODEL_GRAPHS.get("claude-opus-or") or graph_openrouter
graph_glm_4_7 = _MODEL_GRAPHS.get("glm-4.7") or graph_zhipu

# Right Code Claude models (third-party API)
graph_claude_opus_right = _MODEL_GRAPHS.get("claude-opus-right") or graph_anthropic
graph_claude_opus_right_thinking = _MODEL_GRAPHS.get("claude-opus-right-thinking") or graph_anthropic
graph_claude_sonnet_right = _MODEL_GRAPHS.get("claude-sonnet-right") or graph_anthropic
graph_claude_sonnet_right_thinking = _MODEL_GRAPHS.get("claude-sonnet-right-thinking") or graph_anthropic

# Legacy model aliases
graph_gemini_3_pro = _MODEL_GRAPHS.get("gemini-3-pro") or graph_gemini
graph_gpt_5 = _MODEL_GRAPHS.get("gpt-5") or graph_openai
graph_gpt_5_thinking = _MODEL_GRAPHS.get("gpt-5-thinking") or graph_openai

# Web-dev mode graphs (with artifact output support)
graph_deepseek_chat_webdev = _MODEL_GRAPHS.get("deepseek-chat-web-dev") or graph_deepseek_webdev
graph_deepseek_reasoner_webdev = _MODEL_GRAPHS.get("deepseek-reasoner-web-dev") or graph_deepseek_webdev
graph_qwen_plus_webdev = _MODEL_GRAPHS.get("qwen-plus-web-dev") or graph_qwen_webdev
graph_qwen3_max_webdev = _MODEL_GRAPHS.get("qwen3-max-web-dev") or graph_qwen_webdev
graph_minimax_m2_webdev = _MODEL_GRAPHS.get("minimax-m2-web-dev") or graph_minimax_webdev
graph_claude_opus_or_webdev = _MODEL_GRAPHS.get("claude-opus-or-web-dev") or graph_openrouter_webdev
graph_glm_4_7_webdev = _MODEL_GRAPHS.get("glm-4.7-web-dev") or graph_zhipu_webdev

# Right Code Claude web-dev mode graphs
graph_claude_opus_right_webdev = _MODEL_GRAPHS.get("claude-opus-right-web-dev") or graph_anthropic_webdev
graph_claude_opus_right_thinking_webdev = _MODEL_GRAPHS.get("claude-opus-right-thinking-web-dev") or graph_anthropic_webdev
graph_claude_sonnet_right_webdev = _MODEL_GRAPHS.get("claude-sonnet-right-web-dev") or graph_anthropic_webdev
graph_claude_sonnet_right_thinking_webdev = _MODEL_GRAPHS.get("claude-sonnet-right-thinking-web-dev") or graph_anthropic_webdev

# Legacy web-dev mode graph aliases
graph_gemini_3_pro_webdev = _MODEL_GRAPHS.get("gemini-3-pro-web-dev") or graph_gemini_webdev
graph_gpt_5_webdev = _MODEL_GRAPHS.get("gpt-5-web-dev") or graph_openai_webdev
graph_gpt_5_thinking_webdev = _MODEL_GRAPHS.get("gpt-5-thinking-web-dev") or graph_openai_webdev

# OpenRouter Llama models
graph_llama_4_maverick = _MODEL_GRAPHS.get("llama-4-maverick") or graph_openrouter
graph_llama_4_maverick_webdev = _MODEL_GRAPHS.get("llama-4-maverick-web-dev") or graph_openrouter_webdev
graph_llama_3_3_70b = _MODEL_GRAPHS.get("llama-3.3-70b") or graph_openrouter
graph_llama_3_3_70b_webdev = _MODEL_GRAPHS.get("llama-3.3-70b-web-dev") or graph_openrouter_webdev


# =============================================================================
# Convenience Functions
# =============================================================================

def invoke(query: str, thread_id: str = "default", user_id: str = "default") -> dict:
    """
    Invoke the agent with a query

    Args:
        query: User's question or request
        thread_id: Thread ID for conversation persistence
        user_id: User ID for file ownership

    Returns:
        Agent response dict
    """
    # Set context variables for tools to access
    _user_id_ctx.set(user_id)
    _thread_id_ctx.set(thread_id)

    config = {"configurable": {"thread_id": thread_id}}
    result = graph.invoke(
        {"messages": [HumanMessage(content=query)]},
        config=config,
    )
    return result


def stream(query: str, thread_id: str = "default", user_id: str = "default"):
    """
    Stream the agent's response

    Args:
        query: User's question or request
        thread_id: Thread ID for conversation persistence
        user_id: User ID for file ownership

    Yields:
        Streaming events from the agent
    """
    # Set context variables for tools to access
    _user_id_ctx.set(user_id)
    _thread_id_ctx.set(thread_id)

    config = {"configurable": {"thread_id": thread_id}}
    for event in graph.stream(
        {"messages": [HumanMessage(content=query)]},
        config=config,
        stream_mode="values",
    ):
        yield event
