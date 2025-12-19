"""
Python 回归结果表格生成模板

实现与 Stata esttab 等效的三线表输出格式：
- 系数保留 4 位小数
- 标准误在系数下方（括号内）
- 显著性星号：* 10%, ** 5%, *** 1%
- 报告 R²，样本量在最后
- 支持多模型横向对比

使用方法：
    from regression_table import create_regression_table, RegressionResult

    # 收集回归结果
    results = [
        RegressionResult(model1, name="(1)"),
        RegressionResult(model2, name="(2)"),
    ]

    # 生成表格
    table = create_regression_table(results, drop_vars=['year'])
    print(table)
"""

import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import List, Optional, Union
import statsmodels.api as sm


@dataclass
class RegressionResult:
    """存储单个回归结果"""
    model: any  # statsmodels 回归结果对象
    name: str = ""  # 列名，如 "(1)", "(2)"

    def get_coef(self, var: str) -> Optional[float]:
        """获取系数"""
        if var in self.model.params.index:
            return self.model.params[var]
        return None

    def get_se(self, var: str) -> Optional[float]:
        """获取标准误"""
        if var in self.model.bse.index:
            return self.model.bse[var]
        return None

    def get_pvalue(self, var: str) -> Optional[float]:
        """获取 p 值"""
        if var in self.model.pvalues.index:
            return self.model.pvalues[var]
        return None

    def get_stars(self, var: str) -> str:
        """获取显著性星号"""
        p = self.get_pvalue(var)
        if p is None:
            return ""
        if p < 0.01:
            return "***"
        elif p < 0.05:
            return "**"
        elif p < 0.1:
            return "*"
        return ""

    @property
    def nobs(self) -> int:
        """样本量"""
        return int(self.model.nobs)

    @property
    def rsquared(self) -> float:
        """R²"""
        if hasattr(self.model, 'rsquared'):
            return self.model.rsquared
        elif hasattr(self.model, 'rsquared_overall'):
            return self.model.rsquared_overall
        return np.nan


def format_coef(coef: float, stars: str, decimal: int = 4) -> str:
    """格式化系数"""
    if coef is None or np.isnan(coef):
        return ""
    return f"{coef:.{decimal}f}{stars}"


def format_se(se: float, decimal: int = 4) -> str:
    """格式化标准误（带括号）"""
    if se is None or np.isnan(se):
        return ""
    return f"({se:.{decimal}f})"


def create_regression_table(
    results: List[RegressionResult],
    var_names: Optional[List[str]] = None,
    var_labels: Optional[dict] = None,
    drop_vars: Optional[List[str]] = None,
    drop_patterns: Optional[List[str]] = None,
    decimal: int = 4,
    show_se: bool = True,
    show_n: bool = True,
    show_r2: bool = True,
) -> str:
    """
    生成 esttab 风格的回归结果表格

    Args:
        results: RegressionResult 列表
        var_names: 要显示的变量列表（按顺序）
        var_labels: 变量标签映射 {变量名: 显示名}
        drop_vars: 要隐藏的变量列表
        drop_patterns: 要隐藏的变量名模式（如 ['year', 'industry']）
        decimal: 小数位数
        show_se: 是否显示标准误
        show_n: 是否显示样本量
        show_r2: 是否显示 R²

    Returns:
        格式化的表格字符串
    """
    if not results:
        return "No results to display"

    # 收集所有变量
    all_vars = set()
    for r in results:
        all_vars.update(r.model.params.index)

    # 过滤变量
    drop_vars = drop_vars or []
    drop_patterns = drop_patterns or []

    def should_drop(var: str) -> bool:
        if var in drop_vars:
            return True
        for pattern in drop_patterns:
            if pattern.lower() in var.lower():
                return True
        return False

    filtered_vars = [v for v in all_vars if not should_drop(v)]

    # 确定变量顺序
    if var_names:
        ordered_vars = [v for v in var_names if v in filtered_vars]
        # 添加未指定但存在的变量
        remaining = [v for v in filtered_vars if v not in ordered_vars]
        ordered_vars.extend(sorted(remaining))
    else:
        # 按首个模型的顺序
        ordered_vars = [v for v in results[0].model.params.index if v in filtered_vars]

    # 变量标签
    var_labels = var_labels or {}

    # 构建表格数据
    rows = []

    # 表头
    header = [""] + [r.name for r in results]
    rows.append(header)
    rows.append(["-" * 15] * len(header))  # 分隔线

    # 变量行
    for var in ordered_vars:
        label = var_labels.get(var, var)

        # 系数行
        coef_row = [label]
        for r in results:
            coef = r.get_coef(var)
            stars = r.get_stars(var)
            coef_row.append(format_coef(coef, stars, decimal))
        rows.append(coef_row)

        # 标准误行
        if show_se:
            se_row = [""]
            for r in results:
                se = r.get_se(var)
                se_row.append(format_se(se, decimal))
            rows.append(se_row)

    rows.append(["-" * 15] * len(header))  # 分隔线

    # 统计量
    if show_n:
        n_row = ["N"]
        for r in results:
            n_row.append(str(r.nobs))
        rows.append(n_row)

    if show_r2:
        r2_row = ["R²"]
        for r in results:
            r2_row.append(f"{r.rsquared:.{decimal}f}")
        rows.append(r2_row)

    rows.append(["-" * 15] * len(header))  # 底线

    # 注释
    rows.append(["注：括号内为标准误。* p<0.1, ** p<0.05, *** p<0.01"])

    # 格式化为字符串
    col_widths = []
    for col_idx in range(len(header)):
        max_width = max(len(str(row[col_idx])) if col_idx < len(row) else 0 for row in rows[:-1])
        col_widths.append(max(max_width, 12))

    output_lines = []
    for row in rows:
        if len(row) == 1:  # 注释行
            output_lines.append(row[0])
        else:
            formatted_row = []
            for col_idx, cell in enumerate(row):
                if col_idx == 0:
                    formatted_row.append(str(cell).ljust(col_widths[col_idx]))
                else:
                    formatted_row.append(str(cell).center(col_widths[col_idx]))
            output_lines.append("  ".join(formatted_row))

    return "\n".join(output_lines)


def create_latex_table(
    results: List[RegressionResult],
    var_names: Optional[List[str]] = None,
    var_labels: Optional[dict] = None,
    drop_vars: Optional[List[str]] = None,
    drop_patterns: Optional[List[str]] = None,
    decimal: int = 4,
    caption: str = "Regression Results",
    label: str = "tab:regression",
) -> str:
    """
    生成 LaTeX 格式的三线表

    Returns:
        LaTeX 表格代码
    """
    if not results:
        return "% No results"

    # 收集所有变量
    all_vars = set()
    for r in results:
        all_vars.update(r.model.params.index)

    # 过滤变量
    drop_vars = drop_vars or []
    drop_patterns = drop_patterns or []

    def should_drop(var: str) -> bool:
        if var in drop_vars:
            return True
        for pattern in drop_patterns:
            if pattern.lower() in var.lower():
                return True
        return False

    filtered_vars = [v for v in all_vars if not should_drop(v)]

    # 确定变量顺序
    if var_names:
        ordered_vars = [v for v in var_names if v in filtered_vars]
        remaining = [v for v in filtered_vars if v not in ordered_vars]
        ordered_vars.extend(sorted(remaining))
    else:
        ordered_vars = [v for v in results[0].model.params.index if v in filtered_vars]

    var_labels = var_labels or {}

    # 构建 LaTeX
    n_cols = len(results) + 1
    col_spec = "l" + "c" * len(results)

    lines = [
        r"\begin{table}[htbp]",
        r"\centering",
        f"\\caption{{{caption}}}",
        f"\\label{{{label}}}",
        f"\\begin{{tabular}}{{{col_spec}}}",
        r"\toprule",
    ]

    # 表头
    header = " & ".join([""] + [r.name for r in results]) + r" \\"
    lines.append(header)
    lines.append(r"\midrule")

    # 变量行
    for var in ordered_vars:
        label = var_labels.get(var, var).replace("_", r"\_")

        # 系数行
        coef_cells = [label]
        for r in results:
            coef = r.get_coef(var)
            stars = r.get_stars(var)
            if coef is not None:
                coef_cells.append(f"{coef:.{decimal}f}$^{{{stars}}}$" if stars else f"{coef:.{decimal}f}")
            else:
                coef_cells.append("")
        lines.append(" & ".join(coef_cells) + r" \\")

        # 标准误行
        se_cells = [""]
        for r in results:
            se = r.get_se(var)
            if se is not None:
                se_cells.append(f"({se:.{decimal}f})")
            else:
                se_cells.append("")
        lines.append(" & ".join(se_cells) + r" \\")

    lines.append(r"\midrule")

    # N 和 R²
    n_cells = ["N"] + [str(r.nobs) for r in results]
    lines.append(" & ".join(n_cells) + r" \\")

    r2_cells = ["$R^2$"] + [f"{r.rsquared:.{decimal}f}" for r in results]
    lines.append(" & ".join(r2_cells) + r" \\")

    lines.append(r"\bottomrule")
    lines.append(r"\end{tabular}")
    lines.append(r"\begin{tablenotes}")
    lines.append(r"\small")
    lines.append(r"\item 注：括号内为标准误。$^{*}$ p$<$0.1, $^{**}$ p$<$0.05, $^{***}$ p$<$0.01")
    lines.append(r"\end{tablenotes}")
    lines.append(r"\end{table}")

    return "\n".join(lines)


# 使用示例
if __name__ == "__main__":
    # 生成示例数据
    np.random.seed(42)
    n = 1000
    df = pd.DataFrame({
        'x1': np.random.randn(n),
        'x2': np.random.randn(n),
        'x3': np.random.randn(n),
    })
    df['y'] = 1.5 + 2.0 * df['x1'] - 0.5 * df['x2'] + 0.3 * df['x3'] + np.random.randn(n)

    # 运行回归
    X1 = sm.add_constant(df[['x1']])
    model1 = sm.OLS(df['y'], X1).fit()

    X2 = sm.add_constant(df[['x1', 'x2']])
    model2 = sm.OLS(df['y'], X2).fit()

    X3 = sm.add_constant(df[['x1', 'x2', 'x3']])
    model3 = sm.OLS(df['y'], X3).fit()

    # 生成表格
    results = [
        RegressionResult(model1, "(1)"),
        RegressionResult(model2, "(2)"),
        RegressionResult(model3, "(3)"),
    ]

    print("=" * 60)
    print("文本格式表格")
    print("=" * 60)
    print(create_regression_table(results))

    print("\n" + "=" * 60)
    print("LaTeX 格式表格")
    print("=" * 60)
    print(create_latex_table(results, caption="基准回归结果"))
