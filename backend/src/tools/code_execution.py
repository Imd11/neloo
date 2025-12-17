"""
Code Execution Tool

Provides Python code execution in secure sandboxes.
"""

from typing import Any
from ..sandbox import execute_python


def execute_python_tool(
    code: str,
    timeout: int = 120,
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

    Returns:
        dict with keys:
        - success: bool indicating execution success
        - stdout: Standard output from execution
        - stderr: Standard error from execution
        - results: List of result objects (text, images, etc.)
        - error: Error message if execution failed

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
        ''')

        if result['success']:
            print(result['stdout'])
        else:
            print(f"Error: {result['error']}")
    """
    return execute_python(code=code, timeout=timeout)


def execute_regression(
    code: str,
    timeout: int = 180,
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
    return execute_python(code=code, timeout=timeout)


def generate_latex_table(
    code: str,
    timeout: int = 120,
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
    return execute_python(code=code, timeout=timeout)
