"""
Data Analyst Agent - Core Graph Definition

This module defines the main agent graph using LangChain Deep Agents.
Compatible with LangGraph server for frontend integration.

Architecture:
- Uses create_deep_agent() for automatic TodoList planning
- FilesystemMiddleware for file operations
- SubAgentMiddleware for parallel data analysis tasks
- HumanInTheLoopMiddleware for sensitive operation approval
- Custom tools: execute_python (sandbox), search_web (Tavily)
- Context Engineering: Dual-form output + file storage (Manus strategy)
- Web Development Mode: Specialized prompt for generating renderable code artifacts
"""

import os
from typing import Annotated
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from deepagents import create_deep_agent, SubAgent

from ..tools.search import internet_search
from ..tools.code_execution import execute_python_tool
from ..tools.knowledge import search_knowledge as search_knowledge_tool, list_knowledge_categories
from ..context import (
    create_dual_output,
    save_result_to_file,
    should_save_to_file,
    format_file_reference,
)
from ..storage import save_image_base64, get_image_url

from ..runtime_context import user_id_ctx as _user_id_ctx, thread_id_ctx as _thread_id_ctx

# API base URL for image serving (configurable via environment)
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:2024")


# =============================================================================
# Data Analyst System Prompt (appended to Deep Agents base prompt)
# =============================================================================

DATA_ANALYST_PROMPT = """You are an expert data analyst AI assistant, specialized in:

1. **Exploratory Data Analysis (EDA)**
   - Data cleaning and preprocessing
   - Descriptive statistics
   - Data visualization (histograms, scatter plots, correlation matrices)

2. **Statistical Analysis**
   - Hypothesis testing (t-tests, chi-square, ANOVA)
   - Correlation and regression analysis
   - Time series analysis

3. **Econometric Methods**
   - OLS (Ordinary Least Squares) regression
   - Panel data analysis (Fixed Effects, Random Effects)
   - Difference-in-Differences (DID)
   - Instrumental Variables (IV/2SLS)

4. **Output Formatting**
   - Generate publication-quality LaTeX tables
   - Create clear visualizations
   - Write structured analysis reports

## Custom Tools

1. `execute_python` - Execute Python code in a secure sandbox
   - Pre-installed: pandas, numpy, scipy, statsmodels, matplotlib, seaborn
   - Use for all data analysis and computation tasks
   - Images are automatically captured and returned

2. `search_web` - Search the internet for information
   - Use for finding documentation, examples, or domain knowledge

3. `search_knowledge` - Search the econometrics knowledge base (RAG)
   - Contains methodology guides for DID, IV, RDD, Panel data, etc.
   - Contains analysis checklists and best practices
   - Contains common errors and how to avoid them
   - **Use BEFORE starting any econometric analysis** to refresh best practices
   - Example: "How to test parallel trends in DID?"

4. `list_knowledge_categories` - List available knowledge categories
   - Use to understand what knowledge is available

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

## Data Analysis Guidelines

1. **Plan before executing**: Use the todo list to break down complex analyses
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


# Custom tools for the data analyst agent
CUSTOM_TOOLS = [execute_python, search_web, search_knowledge_tool, list_knowledge_categories]


# =============================================================================
# SubAgent Definitions for Parallel Data Analysis
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
    "openrouter": {"max_input_tokens": 180000},   # OpenRouter Claude: same as Anthropic
    "88api": {"max_input_tokens": 180000},        # 88api Claude: same as Anthropic
    "88v1": {"max_input_tokens": 180000},         # 88v1 Claude: same as Anthropic
}

# =============================================================================
# Model Configuration Registry
# =============================================================================
# Each model entry defines how to initialize it with init_chat_model
# Keys: model_id (used in API), display_name, model_name, provider, env_key, base_url_env, profile_key
AVAILABLE_MODELS = {
    "deepseek-chat": {
        "display_name": "DeepSeek V3.2",
        "model_name": "deepseek-chat",
        "provider": "deepseek",
        "env_key": "DEEPSEEK_API_KEY",
        "base_url_env": None,
        "profile_key": "deepseek",
    },
    "deepseek-reasoner": {
        "display_name": "DeepSeek V3.2 (思考)",
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
        "provider": "openai",  # Uses OpenAI-compatible mode
        "env_key": "MINIMAX_API_KEY",
        "base_url_env": "MINIMAX_BASE_URL",
        "profile_key": "minimax",
    },
    "claude-opus": {
        "display_name": "Claude Opus 4.5",
        "model_name": "claude-opus-4-5-20251101",
        "provider": "anthropic",
        "env_key": "ANTHROPIC_API_KEY",
        "base_url_env": "ANTHROPIC_BASE_URL",
        "profile_key": "anthropic",
    },
    "claude-opus-or": {
        "display_name": "Claude Opus 4.5 (OR)",
        "model_name": "anthropic/claude-opus-4.5",
        "provider": "openai",  # OpenRouter uses OpenAI-compatible API
        "env_key": "OPENROUTER_API_KEY",
        "base_url_env": "OPENROUTER_BASE_URL",
        "profile_key": "openrouter",
    },
    "claude-opus-88api": {
        "display_name": "Claude Opus 4.5 (88api)",
        "model_name": "claude-opus-4-5-20251101",
        "provider": "openai",  # 88api uses OpenAI-compatible API
        "env_key": "API_88_KEY",
        "base_url_env": "API_88_BASE_URL",
        "profile_key": "88api",
    },
    "claude-opus-88v1": {
        "display_name": "Claude Opus 4.5 (88v1)",
        "model_name": "claude-opus-4-5-20251101",
        "provider": "openai",  # 88v1 uses OpenAI-compatible API
        "env_key": "API_88V1_KEY",
        "base_url_env": "API_88V1_BASE_URL",
        "profile_key": "88v1",
    },
}


def get_available_models() -> list[dict]:
    """
    Get list of available models based on configured API keys.

    Returns list of model info dicts with id, display_name, and available status.
    """
    available = []
    for model_id, config in AVAILABLE_MODELS.items():
        api_key = os.environ.get(config["env_key"])
        if api_key:
            available.append({
                "id": model_id,
                "display_name": config["display_name"],
                "available": True,
            })
    return available


def get_default_model_id() -> str | None:
    """
    Get the default model ID based on available API keys.
    Priority: DeepSeek > Qwen > MiniMax
    """
    # Priority order
    priority = ["deepseek-chat", "qwen-plus", "minimax-m1"]
    for model_id in priority:
        config = AVAILABLE_MODELS.get(model_id)
        if config and os.environ.get(config["env_key"]):
            return model_id
    return None


def get_model(model_id: str | None = None):
    """
    Initialize the language model.

    Args:
        model_id: Specific model to use (e.g., "deepseek-chat", "qwen-plus").
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
            "No API key found. Set one of: "
            "DEEPSEEK_API_KEY, QWEN_API_KEY, MINIMAX_API_KEY"
        )

    # Get model configuration
    config = AVAILABLE_MODELS.get(model_id)
    if not config:
        raise ValueError(f"Unknown model: {model_id}. Available: {list(AVAILABLE_MODELS.keys())}")

    # Check API key is available
    api_key = os.environ.get(config["env_key"])
    if not api_key:
        raise ValueError(f"API key not configured for {model_id}. Set {config['env_key']}")

    # Build init_chat_model kwargs
    kwargs = {
        "model_provider": config["provider"],
        "api_key": api_key,
        "timeout": 600,  # 10 minutes for complex data analysis
        "max_retries": 2,
    }

    # Add base_url if configured
    if config["base_url_env"]:
        base_url = os.environ.get(config["base_url_env"])
        if base_url:
            kwargs["base_url"] = base_url

    # Initialize model
    model = init_chat_model(config["model_name"], **kwargs)

    # CRITICAL: Set profile for SummarizationMiddleware
    model.profile = MODEL_PROFILES[config["profile_key"]]

    return model


# =============================================================================
# Create Deep Agent
# =============================================================================

def build_graph(model_id: str | None = None, mode: str = "default"):
    """
    Build the data analyst agent using Deep Agents architecture.

    Args:
        model_id: Specific model to use (e.g., "deepseek-chat", "qwen-plus").
                  If None, uses default based on available API keys.
        mode: Agent mode. Options:
              - "default": Standard data analyst mode
              - "web-dev": Web development mode with artifact output

    This provides:
    - TodoListMiddleware: Automatic task planning with write_todos tool
    - FilesystemMiddleware: File operations (ls, read, write, edit, glob, grep)
    - SubAgentMiddleware: Parallel data analysis with specialized subagents
      - eda-analyst: Exploratory Data Analysis
      - stats-analyst: Statistical hypothesis testing
      - regression-analyst: Econometric/regression analysis
      - viz-analyst: Data visualization
      - general-purpose: Generic task delegation
    - HumanInTheLoopMiddleware: Approval for sensitive operations (optional)
    - Custom tools: execute_python, search_web

    Environment Variables:
    - ENABLE_HITL: Set to "true" to enable human approval for sensitive operations
    """
    model = get_model(model_id)

    # Build system prompt based on mode
    system_prompt = DATA_ANALYST_PROMPT
    if mode == "web-dev":
        system_prompt = DATA_ANALYST_PROMPT + "\n\n" + WEB_DEV_PROMPT

    # Determine interrupt_on config based on ENABLE_HITL environment variable
    interrupt_on = INTERRUPT_ON_CONFIG if ENABLE_HITL else None

    return create_deep_agent(
        model=model,
        tools=CUSTOM_TOOLS,
        system_prompt=system_prompt,
        subagents=DATA_ANALYST_SUBAGENTS,  # Enable specialized subagents
        interrupt_on=interrupt_on,          # Enable HITL if configured
    )


# =============================================================================
# Export Graphs for LangGraph Server
# =============================================================================

# Build graphs for each available model
# LangGraph Server will expose these as separate assistants
def _build_model_graphs() -> dict:
    """
    Build graphs for each available model, including web-dev variants.

    Returns a dict mapping model_id to compiled graph.
    Only builds graphs for models with configured API keys.

    For each model, we build:
    - {model_id}: Default mode graph
    - {model_id}-web-dev: Web development mode graph with artifact output
    """
    graphs = {}
    for model_id in AVAILABLE_MODELS.keys():
        config = AVAILABLE_MODELS[model_id]
        api_key = os.environ.get(config["env_key"])
        if api_key:
            try:
                # Build default mode graph
                graphs[model_id] = build_graph(model_id, mode="default")
                print(f"[graph.py] Built graph for model: {model_id}")

                # Build web-dev mode graph
                webdev_id = f"{model_id}-web-dev"
                graphs[webdev_id] = build_graph(model_id, mode="web-dev")
                print(f"[graph.py] Built graph for model: {webdev_id}")
            except Exception as e:
                print(f"[graph.py] Failed to build graph for {model_id}: {e}")
    return graphs


# Build all available model graphs
_MODEL_GRAPHS = _build_model_graphs()

# Default graph (for backwards compatibility with LangGraph Server)
# Uses the default model based on priority
graph = _MODEL_GRAPHS.get(get_default_model_id()) or build_graph()

# Export individual graphs for LangGraph Server multi-assistant setup
# Default mode graphs
graph_deepseek_chat = _MODEL_GRAPHS.get("deepseek-chat")
graph_deepseek_reasoner = _MODEL_GRAPHS.get("deepseek-reasoner")
graph_qwen_plus = _MODEL_GRAPHS.get("qwen-plus")
graph_qwen3_max = _MODEL_GRAPHS.get("qwen3-max")
graph_minimax_m2 = _MODEL_GRAPHS.get("minimax-m2")
graph_claude_opus = _MODEL_GRAPHS.get("claude-opus")
graph_claude_opus_or = _MODEL_GRAPHS.get("claude-opus-or")
graph_claude_opus_88api = _MODEL_GRAPHS.get("claude-opus-88api")
graph_claude_opus_88v1 = _MODEL_GRAPHS.get("claude-opus-88v1")

# Web-dev mode graphs (with artifact output support)
graph_deepseek_chat_webdev = _MODEL_GRAPHS.get("deepseek-chat-web-dev")
graph_deepseek_reasoner_webdev = _MODEL_GRAPHS.get("deepseek-reasoner-web-dev")
graph_qwen_plus_webdev = _MODEL_GRAPHS.get("qwen-plus-web-dev")
graph_qwen3_max_webdev = _MODEL_GRAPHS.get("qwen3-max-web-dev")
graph_minimax_m2_webdev = _MODEL_GRAPHS.get("minimax-m2-web-dev")
graph_claude_opus_webdev = _MODEL_GRAPHS.get("claude-opus-web-dev")
graph_claude_opus_or_webdev = _MODEL_GRAPHS.get("claude-opus-or-web-dev")
graph_claude_opus_88api_webdev = _MODEL_GRAPHS.get("claude-opus-88api-web-dev")
graph_claude_opus_88v1_webdev = _MODEL_GRAPHS.get("claude-opus-88v1-web-dev")


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
