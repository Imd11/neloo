"""
Code Execution Tool

Provides Python code execution in secure sandboxes.
"""

from typing import Any, Optional
from datetime import datetime
import secrets

from ..sandbox import execute_python


def execute_python_tool(
    code: str,
    timeout: int = 120,
    user_id: str = "default",
    thread_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Execute Python code in a secure sandbox

    Executes the provided Python code in an isolated environment.
    The sandbox mode is determined by SANDBOX_MODE environment variable:
    - "e2b": E2B cloud sandbox (default, recommended)
    - "local": Local subprocess (development only)
    - "docker": Docker container (self-hosted)

    Pre-installed packages in E2B sandbox:
    - pandas, numpy, scipy
    - statsmodels
    - matplotlib, seaborn
    - scikit-learn

    Args:
        code: Python code to execute
        timeout: Maximum execution time in seconds (default: 120)
        user_id: User ID for file ownership (for saving generated files to database)
        thread_id: Thread ID for file-thread associations

    Returns:
        dict with keys:
        - success: bool indicating execution success
        - stdout: Standard output from execution
        - stderr: Standard error from execution
        - results: List of result objects (text, images, etc.)
        - error: Error message if execution failed
        - generated_files: List of files generated during execution

    Example:
        result = execute_python_tool('''
        import pandas as pd
        import numpy as np

        # Create sample data
        np.random.seed(42)
        df = pd.DataFrame({
            'x': np.random.randn(100),
            'y': np.random.randn(100) * 2 + 3
        })

        # Calculate correlation
        correlation = df['x'].corr(df['y'])
        print(f"Correlation: {correlation:.4f}")

        # Basic statistics
        print(df.describe())
        ''', user_id="user-123", thread_id="thread-456")

        if result['success']:
            print(result['stdout'])
        else:
            print(f"Error: {result['error']}")
    """
    result = execute_python(code=code, timeout=timeout, user_id=user_id, thread_id=thread_id)

    # Persist executed code to files/thread_files so the thread's Files panel can be DB-authoritative.
    # This is intentionally best-effort: execution results should still return even if persistence fails.
    try:
        if thread_id and user_id and user_id not in ("default", "anonymous"):
            from ..storage.file_storage import save_generated_file

            ts = datetime.now().strftime("%Y%m%d")
            suffix = secrets.token_hex(2)  # 4 hex chars
            filename = f"code_{ts}_{suffix}.py"
            code_bytes = code.encode("utf-8")
            file_info = save_generated_file(
                filename=filename,
                data=code_bytes,
                user_id=user_id,
                thread_id=thread_id,
                file_type="code",
            )
            if file_info:
                generated_files = result.get("generated_files")
                if isinstance(generated_files, list):
                    generated_files.append({
                        "filename": filename,
                        "sandbox_path": f"/home/user/data/{filename}",
                        "size": len(code_bytes),
                        "download_url": file_info.get("download_url"),
                        "file_id": file_info.get("file_id"),
                        "content_type": file_info.get("content_type") or "text/x-python",
                        "file_type": "code",
                    })
    except Exception:
        pass

    return result


def execute_regression(
    code: str,
    timeout: int = 180,
    user_id: str = "default",
    thread_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Execute regression analysis code

    Specialized wrapper for running statistical regressions.
    Uses extended timeout for complex computations.

    Pre-installed libraries:
    - statsmodels: OLS, Panel, IV, DID
    - linearmodels: Panel data models
    - scipy: Statistical tests

    Args:
        code: Python code for regression analysis
        timeout: Maximum execution time in seconds (default: 180)
        user_id: User ID for file ownership
        thread_id: Thread ID for file-thread associations

    Returns:
        Execution result dict

    Example:
        result = execute_regression('''
        import statsmodels.api as sm
        import numpy as np

        # Generate sample data
        np.random.seed(42)
        n = 1000
        X = np.random.randn(n, 3)
        y = X @ [1, 2, 3] + np.random.randn(n) * 0.5

        # Run OLS regression
        X_with_const = sm.add_constant(X)
        model = sm.OLS(y, X_with_const)
        results = model.fit()

        # Print summary
        print(results.summary())
        ''')
    """
    return execute_python(code=code, timeout=timeout, user_id=user_id, thread_id=thread_id)


def generate_latex_table(
    code: str,
    timeout: int = 120,
    user_id: str = "default",
    thread_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Generate LaTeX formatted regression tables

    Executes code that produces LaTeX output for academic papers.

    Supported table generators:
    - statsmodels summary to LaTeX
    - stargazer-like output
    - Custom formatting

    Args:
        code: Python code to generate LaTeX tables
        timeout: Maximum execution time in seconds
        user_id: User ID for file ownership
        thread_id: Thread ID for file-thread associations

    Returns:
        Execution result with LaTeX in results or stdout

    Example:
        result = generate_latex_table('''
        import statsmodels.api as sm
        import numpy as np

        # Run regression
        np.random.seed(42)
        X = np.random.randn(100, 2)
        y = X @ [1, 2] + np.random.randn(100) * 0.5
        model = sm.OLS(y, sm.add_constant(X)).fit()

        # Generate LaTeX
        latex_table = model.summary().as_latex()
        print(latex_table)
        ''')
    """
    return execute_python(code=code, timeout=timeout, user_id=user_id, thread_id=thread_id)
