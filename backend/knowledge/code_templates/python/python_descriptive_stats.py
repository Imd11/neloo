"""
Python 描述性统计表格生成模板

实现与 Stata tabstat/outreg2 等效的描述性统计输出：
- 均值、标准差、最小值、最大值、样本量
- 分组统计
- 三线表格式
- 支持 LaTeX 和文本输出

使用方法：
    from descriptive_stats import create_descriptive_table, create_summary_by_group

    # 基本描述性统计
    table = create_descriptive_table(
        df=df,
        vars=['y', 'x1', 'x2', 'x3'],
        var_labels={'y': '因变量', 'x1': '自变量1'},
        stats=['mean', 'sd', 'min', 'max', 'count'],
    )
    print(table)

    # 分组统计
    grouped = create_summary_by_group(
        df=df,
        vars=['y', 'x1'],
        group_var='treat',
        group_labels={0: '控制组', 1: '处理组'},
    )
    print(grouped)
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Literal, Union
from dataclasses import dataclass


def calculate_stats(
    series: pd.Series,
    stats: List[str] = ['mean', 'sd', 'min', 'max', 'count'],
) -> Dict[str, float]:
    """
    计算单个变量的描述性统计量

    Args:
        series: 数据序列
        stats: 统计量列表

    Returns:
        统计量字典
    """
    result = {}
    clean_series = series.dropna()

    stat_funcs = {
        'count': lambda x: len(x),
        'n': lambda x: len(x),
        'mean': lambda x: x.mean(),
        'sd': lambda x: x.std(),
        'std': lambda x: x.std(),
        'min': lambda x: x.min(),
        'max': lambda x: x.max(),
        'median': lambda x: x.median(),
        'p25': lambda x: x.quantile(0.25),
        'p50': lambda x: x.quantile(0.50),
        'p75': lambda x: x.quantile(0.75),
        'p1': lambda x: x.quantile(0.01),
        'p5': lambda x: x.quantile(0.05),
        'p10': lambda x: x.quantile(0.10),
        'p90': lambda x: x.quantile(0.90),
        'p95': lambda x: x.quantile(0.95),
        'p99': lambda x: x.quantile(0.99),
        'sum': lambda x: x.sum(),
        'var': lambda x: x.var(),
        'skewness': lambda x: x.skew(),
        'kurtosis': lambda x: x.kurtosis(),
    }

    for stat in stats:
        if stat.lower() in stat_funcs:
            result[stat] = stat_funcs[stat.lower()](clean_series)
        else:
            result[stat] = np.nan

    return result


def create_descriptive_table(
    df: pd.DataFrame,
    vars: List[str],
    var_labels: Optional[Dict[str, str]] = None,
    stats: List[str] = ['count', 'mean', 'sd', 'min', 'max'],
    stat_labels: Optional[Dict[str, str]] = None,
    decimal: int = 4,
    output_format: Literal['text', 'latex', 'dataframe'] = 'text',
    caption: str = "描述性统计",
    label: str = "tab:descriptive",
) -> Union[str, pd.DataFrame]:
    """
    生成描述性统计表格

    Args:
        df: 数据框
        vars: 变量列表
        var_labels: 变量标签映射
        stats: 统计量列表
        stat_labels: 统计量标签映射
        decimal: 小数位数
        output_format: 输出格式 ('text', 'latex', 'dataframe')
        caption: LaTeX表格标题
        label: LaTeX表格标签

    Returns:
        格式化的表格
    """
    var_labels = var_labels or {}
    stat_labels = stat_labels or {
        'count': 'N',
        'n': 'N',
        'mean': 'Mean',
        'sd': 'Std. Dev.',
        'std': 'Std. Dev.',
        'min': 'Min',
        'max': 'Max',
        'median': 'Median',
        'p25': 'P25',
        'p50': 'P50',
        'p75': 'P75',
    }

    # 计算统计量
    results = []
    for var in vars:
        if var not in df.columns:
            continue

        var_stats = calculate_stats(df[var], stats)
        row = {'Variable': var_labels.get(var, var)}
        for stat in stats:
            label = stat_labels.get(stat, stat)
            row[label] = var_stats.get(stat, np.nan)
        results.append(row)

    result_df = pd.DataFrame(results)

    if output_format == 'dataframe':
        return result_df

    elif output_format == 'latex':
        return _format_latex_descriptive(result_df, stats, stat_labels, decimal, caption, label)

    else:  # text
        return _format_text_descriptive(result_df, decimal)


def _format_text_descriptive(df: pd.DataFrame, decimal: int) -> str:
    """格式化为文本表格"""
    lines = []

    # 计算列宽
    col_widths = {}
    for col in df.columns:
        max_width = max(len(str(col)), df[col].astype(str).str.len().max())
        col_widths[col] = max(max_width, 12)

    # 分隔线
    total_width = sum(col_widths.values()) + 2 * (len(col_widths) - 1)
    separator = "-" * total_width

    lines.append(separator)
    lines.append("描述性统计 (Descriptive Statistics)")
    lines.append(separator)

    # 表头
    header = "  ".join([col.ljust(col_widths[col]) if i == 0 else col.center(col_widths[col])
                        for i, col in enumerate(df.columns)])
    lines.append(header)
    lines.append(separator)

    # 数据行
    for _, row in df.iterrows():
        cells = []
        for i, (col, val) in enumerate(row.items()):
            if i == 0:  # 变量名左对齐
                cells.append(str(val).ljust(col_widths[col]))
            elif isinstance(val, (int, np.integer)):
                cells.append(str(int(val)).center(col_widths[col]))
            elif isinstance(val, (float, np.floating)):
                cells.append(f"{val:.{decimal}f}".center(col_widths[col]))
            else:
                cells.append(str(val).center(col_widths[col]))
        lines.append("  ".join(cells))

    lines.append(separator)

    return "\n".join(lines)


def _format_latex_descriptive(
    df: pd.DataFrame,
    stats: List[str],
    stat_labels: Dict[str, str],
    decimal: int,
    caption: str,
    label: str,
) -> str:
    """格式化为LaTeX三线表"""
    n_cols = len(df.columns)
    col_spec = "l" + "c" * (n_cols - 1)

    lines = [
        r"\begin{table}[htbp]",
        r"\centering",
        f"\\caption{{{caption}}}",
        f"\\label{{{label}}}",
        f"\\begin{{tabular}}{{{col_spec}}}",
        r"\toprule",
    ]

    # 表头
    header = " & ".join(df.columns) + r" \\"
    lines.append(header)
    lines.append(r"\midrule")

    # 数据行
    for _, row in df.iterrows():
        cells = []
        for i, (col, val) in enumerate(row.items()):
            if i == 0:  # 变量名
                cells.append(str(val).replace("_", r"\_"))
            elif isinstance(val, (int, np.integer)):
                cells.append(str(int(val)))
            elif isinstance(val, (float, np.floating)):
                cells.append(f"{val:.{decimal}f}")
            else:
                cells.append(str(val))
        lines.append(" & ".join(cells) + r" \\")

    lines.extend([
        r"\bottomrule",
        r"\end{tabular}",
        r"\end{table}",
    ])

    return "\n".join(lines)


def create_summary_by_group(
    df: pd.DataFrame,
    vars: List[str],
    group_var: str,
    var_labels: Optional[Dict[str, str]] = None,
    group_labels: Optional[Dict, str] = None,
    stats: List[str] = ['mean', 'sd', 'count'],
    decimal: int = 4,
    output_format: Literal['text', 'latex', 'dataframe'] = 'text',
) -> Union[str, pd.DataFrame]:
    """
    生成分组描述性统计表格

    Args:
        df: 数据框
        vars: 变量列表
        group_var: 分组变量名
        var_labels: 变量标签映射
        group_labels: 分组标签映射
        stats: 统计量列表
        decimal: 小数位数
        output_format: 输出格式

    Returns:
        格式化的表格
    """
    var_labels = var_labels or {}
    group_labels = group_labels or {}

    groups = df[group_var].unique()
    groups = sorted(groups)

    results = []

    for var in vars:
        if var not in df.columns:
            continue

        row = {'Variable': var_labels.get(var, var)}

        for group in groups:
            group_data = df[df[group_var] == group][var]
            var_stats = calculate_stats(group_data, stats)

            group_name = group_labels.get(group, str(group))

            for stat in stats:
                col_name = f"{group_name}_{stat}"
                row[col_name] = var_stats.get(stat, np.nan)

        results.append(row)

    result_df = pd.DataFrame(results)

    if output_format == 'dataframe':
        return result_df
    elif output_format == 'latex':
        return _format_latex_grouped(result_df, groups, group_labels, stats, decimal)
    else:
        return _format_text_grouped(result_df, decimal)


def _format_text_grouped(df: pd.DataFrame, decimal: int) -> str:
    """格式化分组统计为文本"""
    lines = []

    total_width = 100
    lines.append("=" * total_width)
    lines.append("分组描述性统计 (Summary Statistics by Group)")
    lines.append("=" * total_width)

    # 简化显示
    formatted_df = df.copy()
    for col in formatted_df.columns:
        if col != 'Variable':
            formatted_df[col] = formatted_df[col].apply(
                lambda x: f"{x:.{decimal}f}" if isinstance(x, (float, np.floating)) else str(int(x)) if isinstance(x, (int, np.integer)) else str(x)
            )

    lines.append(formatted_df.to_string(index=False))
    lines.append("=" * total_width)

    return "\n".join(lines)


def _format_latex_grouped(
    df: pd.DataFrame,
    groups: List,
    group_labels: Dict,
    stats: List[str],
    decimal: int,
) -> str:
    """格式化分组统计为LaTeX"""
    n_groups = len(groups)
    n_stats = len(stats)

    # 多级表头
    col_spec = "l" + "c" * (n_groups * n_stats)

    lines = [
        r"\begin{table}[htbp]",
        r"\centering",
        r"\caption{分组描述性统计}",
        r"\label{tab:summary_by_group}",
        f"\\begin{{tabular}}{{{col_spec}}}",
        r"\toprule",
    ]

    # 第一级表头（组名）
    header1 = " & " + " & ".join([f"\\multicolumn{{{n_stats}}}{{c}}{{{group_labels.get(g, str(g))}}}" for g in groups]) + r" \\"
    lines.append(header1)

    # 第二级表头（统计量）
    stat_labels = {'mean': 'Mean', 'sd': 'SD', 'count': 'N', 'min': 'Min', 'max': 'Max'}
    header2 = " & " + " & ".join([stat_labels.get(s, s) for s in stats] * n_groups) + r" \\"
    lines.append(header2)
    lines.append(r"\midrule")

    # 数据行
    for _, row in df.iterrows():
        cells = [str(row['Variable']).replace("_", r"\_")]
        for col in df.columns[1:]:
            val = row[col]
            if isinstance(val, (int, np.integer)):
                cells.append(str(int(val)))
            elif isinstance(val, (float, np.floating)):
                cells.append(f"{val:.{decimal}f}")
            else:
                cells.append(str(val))
        lines.append(" & ".join(cells) + r" \\")

    lines.extend([
        r"\bottomrule",
        r"\end{tabular}",
        r"\end{table}",
    ])

    return "\n".join(lines)


def create_correlation_matrix(
    df: pd.DataFrame,
    vars: List[str],
    var_labels: Optional[Dict[str, str]] = None,
    decimal: int = 3,
    show_significance: bool = True,
    output_format: Literal['text', 'latex', 'dataframe'] = 'text',
) -> Union[str, pd.DataFrame]:
    """
    生成相关系数矩阵

    Args:
        df: 数据框
        vars: 变量列表
        var_labels: 变量标签映射
        decimal: 小数位数
        show_significance: 是否显示显著性星号
        output_format: 输出格式

    Returns:
        相关系数矩阵
    """
    from scipy import stats as scipy_stats

    var_labels = var_labels or {}
    data = df[vars].copy()

    # 计算相关系数
    corr_matrix = data.corr()

    # 计算p值
    n = len(data)
    p_matrix = pd.DataFrame(np.zeros((len(vars), len(vars))), index=vars, columns=vars)

    for i, var1 in enumerate(vars):
        for j, var2 in enumerate(vars):
            if i != j:
                valid_data = data[[var1, var2]].dropna()
                if len(valid_data) > 2:
                    _, p_val = scipy_stats.pearsonr(valid_data[var1], valid_data[var2])
                    p_matrix.loc[var1, var2] = p_val

    # 添加显著性星号
    def add_stars(corr, p):
        if p < 0.01:
            return f"{corr:.{decimal}f}***"
        elif p < 0.05:
            return f"{corr:.{decimal}f}**"
        elif p < 0.1:
            return f"{corr:.{decimal}f}*"
        else:
            return f"{corr:.{decimal}f}"

    if show_significance:
        result_matrix = corr_matrix.copy()
        for i, var1 in enumerate(vars):
            for j, var2 in enumerate(vars):
                if i != j:
                    result_matrix.loc[var1, var2] = add_stars(
                        corr_matrix.loc[var1, var2],
                        p_matrix.loc[var1, var2]
                    )
                else:
                    result_matrix.loc[var1, var2] = "1.000"

        # 重命名索引和列
        result_matrix.index = [var_labels.get(v, v) for v in vars]
        result_matrix.columns = [var_labels.get(v, v) for v in vars]

        if output_format == 'dataframe':
            return result_matrix
        elif output_format == 'latex':
            return _format_latex_corr(result_matrix)
        else:
            return _format_text_corr(result_matrix)
    else:
        corr_matrix.index = [var_labels.get(v, v) for v in vars]
        corr_matrix.columns = [var_labels.get(v, v) for v in vars]

        if output_format == 'dataframe':
            return corr_matrix
        else:
            return corr_matrix.round(decimal).to_string()


def _format_text_corr(df: pd.DataFrame) -> str:
    """格式化相关系数矩阵为文本"""
    lines = []
    lines.append("=" * 80)
    lines.append("相关系数矩阵 (Correlation Matrix)")
    lines.append("=" * 80)
    lines.append(df.to_string())
    lines.append("-" * 80)
    lines.append("注: * p<0.1, ** p<0.05, *** p<0.01")
    lines.append("=" * 80)
    return "\n".join(lines)


def _format_latex_corr(df: pd.DataFrame) -> str:
    """格式化相关系数矩阵为LaTeX"""
    n = len(df)
    col_spec = "l" + "c" * n

    lines = [
        r"\begin{table}[htbp]",
        r"\centering",
        r"\caption{相关系数矩阵}",
        r"\label{tab:correlation}",
        f"\\begin{{tabular}}{{{col_spec}}}",
        r"\toprule",
    ]

    # 表头
    header = " & " + " & ".join([str(c).replace("_", r"\_") for c in df.columns]) + r" \\"
    lines.append(header)
    lines.append(r"\midrule")

    # 数据行
    for idx, row in df.iterrows():
        cells = [str(idx).replace("_", r"\_")]
        for val in row:
            # 处理星号
            val_str = str(val)
            if '***' in val_str:
                val_str = val_str.replace('***', '$^{***}$')
            elif '**' in val_str:
                val_str = val_str.replace('**', '$^{**}$')
            elif '*' in val_str:
                val_str = val_str.replace('*', '$^{*}$')
            cells.append(val_str)
        lines.append(" & ".join(cells) + r" \\")

    lines.extend([
        r"\bottomrule",
        r"\end{tabular}",
        r"\begin{tablenotes}",
        r"\small",
        r"\item 注：$^{*}$ p$<$0.1, $^{**}$ p$<$0.05, $^{***}$ p$<$0.01",
        r"\end{tablenotes}",
        r"\end{table}",
    ])

    return "\n".join(lines)


# 使用示例
if __name__ == "__main__":
    # 生成示例数据
    np.random.seed(42)
    n = 500

    df = pd.DataFrame({
        'y': np.random.randn(n) * 2 + 5,
        'x1': np.random.randn(n),
        'x2': np.random.randn(n) * 0.5 + 1,
        'x3': np.random.randn(n) * 1.5,
        'treat': np.random.binomial(1, 0.4, n),
    })

    print("=" * 70)
    print("描述性统计示例")
    print("=" * 70)

    # 基本描述性统计
    table = create_descriptive_table(
        df=df,
        vars=['y', 'x1', 'x2', 'x3'],
        var_labels={
            'y': '因变量',
            'x1': '自变量1',
            'x2': '自变量2',
            'x3': '自变量3',
        },
        stats=['count', 'mean', 'sd', 'min', 'max'],
    )
    print("\n文本格式:")
    print(table)

    # LaTeX格式
    print("\n\nLaTeX格式:")
    latex_table = create_descriptive_table(
        df=df,
        vars=['y', 'x1', 'x2', 'x3'],
        output_format='latex',
        caption="变量描述性统计",
    )
    print(latex_table)

    # 分组统计
    print("\n" + "=" * 70)
    print("分组描述性统计")
    print("=" * 70)

    grouped = create_summary_by_group(
        df=df,
        vars=['y', 'x1', 'x2'],
        group_var='treat',
        group_labels={0: '控制组', 1: '处理组'},
        stats=['mean', 'sd', 'count'],
    )
    print(grouped)

    # 相关系数矩阵
    print("\n" + "=" * 70)
    print("相关系数矩阵")
    print("=" * 70)

    corr = create_correlation_matrix(
        df=df,
        vars=['y', 'x1', 'x2', 'x3'],
        var_labels={
            'y': 'Y',
            'x1': 'X1',
            'x2': 'X2',
            'x3': 'X3',
        },
        show_significance=True,
    )
    print(corr)
