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
"""

import os
from contextvars import ContextVar
from typing import Annotated
from langchain_core.messages import HumanMessage
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

# Context variables for passing user_id and thread_id to tools
_user_id_ctx: ContextVar[str] = ContextVar('user_id', default='default')
_thread_id_ctx: ContextVar[str] = ContextVar('thread_id', default='default')

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
- ❌ `ls`, `glob`, `os.listdir()` - will NOT find your files
- ❌ `read_file` tool - operates on virtual filesystem
- ❌ Search for files by partial name
- ❌ Guess or construct file paths

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
# Tool Definitions
# =============================================================================

@tool
def execute_python(
    code: Annotated[str, "Python code to execute"],
    timeout: Annotated[int, "Timeout in seconds"] = 120,
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
    # Get user_id and thread_id from context
    user_id = _user_id_ctx.get()
    thread_id = _thread_id_ctx.get()

    result = execute_python_tool(code=code, timeout=timeout, user_id=user_id, thread_id=thread_id)

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
}


def get_model():
    """
    Initialize the language model based on available API keys.

    Priority: DeepSeek > Anthropic > OpenAI

    IMPORTANT: Sets model.profile for SummarizationMiddleware to work correctly.
    Without profile, the middleware falls back to 170k token threshold which
    exceeds DeepSeek's 64k context window, causing context overflow.
    """
    from langchain.chat_models import init_chat_model

    if os.environ.get("DEEPSEEK_API_KEY"):
        model = init_chat_model(
            "deepseek-chat",
            model_provider="deepseek",
            api_key=os.environ.get("DEEPSEEK_API_KEY"),
            # Increase timeout for complex data analysis tasks
            # DeepSeek can be slow, especially with multiple tool calls
            timeout=600,  # 10 minutes
            max_retries=2,
        )
        # CRITICAL: Set profile for SummarizationMiddleware
        # Without this, middleware uses 170k threshold (> DeepSeek's 64k limit)
        model.profile = MODEL_PROFILES["deepseek"]
        return model
    elif os.environ.get("ANTHROPIC_API_KEY"):
        model = init_chat_model(
            "claude-sonnet-4-5-20250929",
            model_provider="anthropic",
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
            base_url=os.environ.get("ANTHROPIC_BASE_URL"),
            timeout=600,  # 10 minutes
            max_retries=2,
        )
        # Set profile for consistency (Claude usually has this, but be explicit)
        model.profile = MODEL_PROFILES["anthropic"]
        return model
    elif os.environ.get("OPENAI_API_KEY"):
        model = init_chat_model(
            "gpt-4o",
            model_provider="openai",
            api_key=os.environ.get("OPENAI_API_KEY"),
            timeout=600,  # 10 minutes
            max_retries=2,
        )
        # Set profile for consistency
        model.profile = MODEL_PROFILES["openai"]
        return model
    else:
        raise ValueError(
            "No API key found. Set one of: "
            "DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY"
        )


# =============================================================================
# Create Deep Agent
# =============================================================================

def build_graph():
    """
    Build the data analyst agent using Deep Agents architecture.

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
    model = get_model()

    # Determine interrupt_on config based on ENABLE_HITL environment variable
    interrupt_on = INTERRUPT_ON_CONFIG if ENABLE_HITL else None

    return create_deep_agent(
        model=model,
        tools=CUSTOM_TOOLS,
        system_prompt=DATA_ANALYST_PROMPT,
        subagents=DATA_ANALYST_SUBAGENTS,  # Enable specialized subagents
        interrupt_on=interrupt_on,          # Enable HITL if configured
    )


# Export the compiled graph (CompiledStateGraph, compatible with LangGraph Server)
graph = build_graph()


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
