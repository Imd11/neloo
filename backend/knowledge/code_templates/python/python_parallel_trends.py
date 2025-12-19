"""
Python 平行趋势检验图生成模板

实现与 Stata coefplot 等效的事件研究图（Event Study Plot）：
- 垂直布局（vertical）
- 点之间有连线
- 置信区间使用 rcap 样式（带封口的线段）
- 虚线置信区间
- 零线参考
- s1mono 风格（灰度配色）
- 中文标签支持

使用方法：
    from parallel_trends import create_event_study_plot, run_event_study

    # 方法1：从数据直接运行事件研究并绑图
    fig = run_event_study(
        df=df,
        y_var='outcome',
        treat_var='treat',
        time_var='year',
        unit_var='firm_id',
        first_treat_var='first_treat',
        controls=['size', 'age', 'lev'],
        pre_periods=5,
        post_periods=5,
        base_period=-1,
    )
    fig.savefig('parallel_trends.png', dpi=300, bbox_inches='tight')

    # 方法2：从已有回归结果绘图
    fig = create_event_study_plot(
        coefficients=coef_dict,
        std_errors=se_dict,
        periods=[-5, -4, -3, -2, 0, 1, 2, 3, 4, 5],
        base_period=-1,
    )
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass
import warnings

# 尝试设置中文字体
def setup_chinese_font():
    """设置中文字体"""
    chinese_fonts = [
        'SimHei', 'STHeiti', 'Heiti SC', 'Microsoft YaHei',
        'SimSun', 'STSong', 'Songti SC',
        'PingFang SC', 'Hiragino Sans GB',
    ]

    available_fonts = [f.name for f in fm.fontManager.ttflist]

    for font in chinese_fonts:
        if font in available_fonts:
            plt.rcParams['font.sans-serif'] = [font]
            plt.rcParams['axes.unicode_minus'] = False
            return font

    # 如果没有中文字体，使用默认字体
    warnings.warn("No Chinese font found, using default font")
    return None


@dataclass
class EventStudyResult:
    """事件研究结果"""
    periods: List[int]  # 相对时期
    coefficients: Dict[int, float]  # 系数
    std_errors: Dict[int, float]  # 标准误
    conf_low: Dict[int, float]  # 置信区间下界
    conf_high: Dict[int, float]  # 置信区间上界
    base_period: int  # 基期（系数为0的时期）
    n_obs: int  # 样本量


def create_event_study_plot(
    coefficients: Dict[int, float],
    std_errors: Dict[int, float],
    periods: Optional[List[int]] = None,
    base_period: int = -1,
    conf_level: float = 0.95,
    title: str = "图1 平行趋势检验",
    xlabel: str = "相对于政策实施的时间（年）",
    ylabel: str = "估计系数",
    figsize: Tuple[float, float] = (10, 6),
    y_range: Optional[Tuple[float, float]] = None,
    y_ticks: Optional[List[float]] = None,
    show_zero_line: bool = True,
    marker_style: str = 'o',
    marker_size: float = 6,
    marker_color: str = '#333333',
    line_color: str = '#333333',
    ci_color: str = '#666666',
    ci_style: str = '--',
    ci_capsize: float = 3,
    dpi: int = 300,
) -> plt.Figure:
    """
    创建事件研究图（平行趋势检验图）

    Args:
        coefficients: 各时期的系数 {period: coef}
        std_errors: 各时期的标准误 {period: se}
        periods: 时期列表（如果不提供，从coefficients推断）
        base_period: 基期（系数为0），默认-1
        conf_level: 置信水平，默认0.95
        title: 图表标题
        xlabel: X轴标签
        ylabel: Y轴标签
        figsize: 图表尺寸
        y_range: Y轴范围 (min, max)
        y_ticks: Y轴刻度
        show_zero_line: 是否显示零线
        marker_style: 点样式
        marker_size: 点大小
        marker_color: 点颜色
        line_color: 连线颜色
        ci_color: 置信区间颜色
        ci_style: 置信区间线型
        ci_capsize: 置信区间端点大小
        dpi: 图像分辨率

    Returns:
        matplotlib Figure 对象
    """
    setup_chinese_font()

    # 确定时期
    if periods is None:
        periods = sorted(coefficients.keys())

    # 添加基期（系数为0）
    if base_period not in coefficients:
        coefficients = coefficients.copy()
        std_errors = std_errors.copy()
        coefficients[base_period] = 0.0
        std_errors[base_period] = 0.0

    # 排序时期
    periods = sorted(set(periods) | {base_period})

    # 计算置信区间
    from scipy import stats
    z_value = stats.norm.ppf((1 + conf_level) / 2)

    # 准备数据
    x_positions = list(range(len(periods)))
    coefs = [coefficients.get(p, np.nan) for p in periods]
    ses = [std_errors.get(p, np.nan) for p in periods]
    ci_low = [c - z_value * s if not np.isnan(c) else np.nan for c, s in zip(coefs, ses)]
    ci_high = [c + z_value * s if not np.isnan(c) else np.nan for c, s in zip(coefs, ses)]

    # 创建图形
    fig, ax = plt.subplots(figsize=figsize, dpi=dpi)

    # 设置背景为白色（s1mono风格）
    ax.set_facecolor('white')
    fig.patch.set_facecolor('white')

    # 绘制零线
    if show_zero_line:
        ax.axhline(y=0, color='black', linewidth=0.8, linestyle='-')

    # 绘制置信区间（rcap样式：带封口的线段）
    for i, (x, low, high) in enumerate(zip(x_positions, ci_low, ci_high)):
        if not np.isnan(low) and not np.isnan(high):
            # 垂直线
            ax.plot([x, x], [low, high], color=ci_color, linestyle=ci_style, linewidth=1.2)
            # 上下封口
            cap_width = 0.15
            ax.plot([x - cap_width, x + cap_width], [low, low], color=ci_color, linewidth=1.2)
            ax.plot([x - cap_width, x + cap_width], [high, high], color=ci_color, linewidth=1.2)

    # 绘制连线
    valid_indices = [i for i, c in enumerate(coefs) if not np.isnan(c)]
    if len(valid_indices) > 1:
        valid_x = [x_positions[i] for i in valid_indices]
        valid_coefs = [coefs[i] for i in valid_indices]
        ax.plot(valid_x, valid_coefs, color=line_color, linewidth=1.5, zorder=2)

    # 绘制点
    for i, (x, c) in enumerate(zip(x_positions, coefs)):
        if not np.isnan(c):
            ax.plot(x, c, marker=marker_style, markersize=marker_size,
                   color=marker_color, markerfacecolor='white',
                   markeredgewidth=1.5, zorder=3)

    # 设置X轴
    ax.set_xticks(x_positions)
    ax.set_xticklabels([str(p) for p in periods])
    ax.set_xlabel(xlabel, fontsize=11)

    # 设置Y轴
    ax.set_ylabel(ylabel, fontsize=11)
    if y_range:
        ax.set_ylim(y_range)
    if y_ticks:
        ax.set_yticks(y_ticks)
        ax.set_yticklabels([f"{t:.2f}" if t != 0 else "0" for t in y_ticks])

    # 设置标题
    ax.set_title(title, fontsize=12, pad=10)

    # 设置边框（s1mono风格：只保留左边和底边）
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_linewidth(0.8)
    ax.spines['bottom'].set_linewidth(0.8)

    # 设置网格（s1mono风格：浅色水平网格线）
    ax.yaxis.grid(True, linestyle='-', alpha=0.3, color='gray')
    ax.xaxis.grid(False)

    plt.tight_layout()

    return fig


def run_event_study(
    df: pd.DataFrame,
    y_var: str,
    treat_var: str,
    time_var: str,
    unit_var: str,
    first_treat_var: str,
    controls: Optional[List[str]] = None,
    pre_periods: int = 5,
    post_periods: int = 5,
    base_period: int = -1,
    fe_vars: Optional[List[str]] = None,
    cluster_var: Optional[str] = None,
    **plot_kwargs
) -> plt.Figure:
    """
    运行完整的事件研究分析并生成图表

    Args:
        df: 面板数据
        y_var: 因变量名
        treat_var: 处理变量名（0/1）
        time_var: 时间变量名
        unit_var: 个体变量名
        first_treat_var: 首次处理时间变量名
        controls: 控制变量列表
        pre_periods: 处理前的时期数
        post_periods: 处理后的时期数
        base_period: 基期（省略的时期），默认-1
        fe_vars: 固定效应变量列表
        cluster_var: 聚类变量
        **plot_kwargs: 传递给 create_event_study_plot 的参数

    Returns:
        matplotlib Figure 对象
    """
    import statsmodels.api as sm
    from statsmodels.regression.linear_model import OLS

    # 复制数据
    data = df.copy()

    # 计算相对时期
    data['_period'] = data[time_var] - data[first_treat_var]

    # 处理缺失的first_treat（从未处理的组）
    data.loc[data[first_treat_var].isna(), '_period'] = np.nan

    # 生成时期虚拟变量
    periods = list(range(-pre_periods, post_periods + 1))
    periods = [p for p in periods if p != base_period]  # 排除基期

    dummy_vars = []
    for p in periods:
        var_name = f'_period_{p}' if p >= 0 else f'_period_n{abs(p)}'
        data[var_name] = ((data['_period'] == p) & (data[treat_var] == 1)).astype(int)
        dummy_vars.append(var_name)

    # 构建回归公式
    controls = controls or []
    all_vars = dummy_vars + controls

    # 添加固定效应（虚拟变量方式）
    if fe_vars:
        for fe_var in fe_vars:
            dummies = pd.get_dummies(data[fe_var], prefix=f'fe_{fe_var}', drop_first=True)
            data = pd.concat([data, dummies], axis=1)
            all_vars.extend(dummies.columns.tolist())
    else:
        # 默认加入时间固定效应
        time_dummies = pd.get_dummies(data[time_var], prefix='fe_year', drop_first=True)
        data = pd.concat([data, time_dummies], axis=1)
        all_vars.extend(time_dummies.columns.tolist())

    # 准备回归数据
    X = data[all_vars].copy()
    X = sm.add_constant(X)
    y = data[y_var]

    # 删除缺失值
    valid_mask = ~(X.isna().any(axis=1) | y.isna())
    X = X[valid_mask]
    y = y[valid_mask]

    # 运行回归
    if cluster_var:
        # 聚类标准误
        groups = data.loc[valid_mask, cluster_var]
        model = OLS(y, X).fit(cov_type='cluster', cov_kwds={'groups': groups})
    else:
        model = OLS(y, X).fit()

    # 提取系数和标准误
    coefficients = {}
    std_errors = {}

    for p in periods:
        var_name = f'_period_{p}' if p >= 0 else f'_period_n{abs(p)}'
        if var_name in model.params.index:
            coefficients[p] = model.params[var_name]
            std_errors[p] = model.bse[var_name]

    # 添加基期
    coefficients[base_period] = 0.0
    std_errors[base_period] = 0.0

    # 生成图表
    all_periods = sorted(set(periods) | {base_period})

    return create_event_study_plot(
        coefficients=coefficients,
        std_errors=std_errors,
        periods=all_periods,
        base_period=base_period,
        **plot_kwargs
    )


def save_event_study_table(
    coefficients: Dict[int, float],
    std_errors: Dict[int, float],
    p_values: Optional[Dict[int, float]] = None,
    periods: Optional[List[int]] = None,
    base_period: int = -1,
    output_path: Optional[str] = None,
    decimal: int = 4,
) -> pd.DataFrame:
    """
    保存事件研究结果为表格

    Args:
        coefficients: 各时期的系数
        std_errors: 各时期的标准误
        p_values: 各时期的p值（用于显著性星号）
        periods: 时期列表
        base_period: 基期
        output_path: 输出文件路径（可选）
        decimal: 小数位数

    Returns:
        pandas DataFrame
    """
    if periods is None:
        periods = sorted(coefficients.keys())

    # 确保包含基期
    if base_period not in periods:
        periods = sorted(set(periods) | {base_period})

    rows = []
    for p in periods:
        coef = coefficients.get(p, np.nan)
        se = std_errors.get(p, np.nan)

        # 显著性星号
        stars = ""
        if p_values and p in p_values:
            pval = p_values[p]
            if pval < 0.01:
                stars = "***"
            elif pval < 0.05:
                stars = "**"
            elif pval < 0.1:
                stars = "*"

        if p == base_period:
            rows.append({
                '时期': str(p),
                '系数': '(base)',
                '标准误': '',
            })
        else:
            rows.append({
                '时期': str(p),
                '系数': f"{coef:.{decimal}f}{stars}" if not np.isnan(coef) else "",
                '标准误': f"({se:.{decimal}f})" if not np.isnan(se) else "",
            })

    result_df = pd.DataFrame(rows)

    if output_path:
        result_df.to_csv(output_path, index=False, encoding='utf-8-sig')

    return result_df


# 使用示例
if __name__ == "__main__":
    # 生成示例数据
    np.random.seed(42)
    n_units = 100
    n_periods = 15

    # 创建面板数据
    units = np.repeat(range(n_units), n_periods)
    periods = np.tile(range(2005, 2005 + n_periods), n_units)

    # 随机分配处理时间（部分单位从未被处理）
    first_treat = np.random.choice([2010, 2011, 2012, np.nan], n_units, p=[0.3, 0.3, 0.2, 0.2])
    first_treat_expanded = np.repeat(first_treat, n_periods)

    # 生成处理变量
    treat = (periods >= first_treat_expanded).astype(int)
    treat = np.where(np.isnan(first_treat_expanded), 0, treat)

    # 生成结果变量（带有动态处理效应）
    unit_fe = np.repeat(np.random.randn(n_units) * 0.5, n_periods)
    time_fe = np.tile(np.random.randn(n_periods) * 0.3, n_units)

    # 动态处理效应：处理后逐渐增加
    relative_period = periods - first_treat_expanded
    treatment_effect = np.where(
        relative_period >= 0,
        0.1 + 0.05 * relative_period,  # 处理后效应逐渐增加
        0
    )
    treatment_effect = np.where(np.isnan(treatment_effect), 0, treatment_effect)

    y = 1 + unit_fe + time_fe + treatment_effect + np.random.randn(n_units * n_periods) * 0.5

    df = pd.DataFrame({
        'unit_id': units,
        'year': periods,
        'first_treat': first_treat_expanded,
        'treat': treat,
        'y': y,
        'size': np.random.randn(n_units * n_periods),
        'age': np.random.randn(n_units * n_periods),
    })

    print("=" * 60)
    print("事件研究分析示例")
    print("=" * 60)

    # 运行事件研究
    fig = run_event_study(
        df=df,
        y_var='y',
        treat_var='treat',
        time_var='year',
        unit_var='unit_id',
        first_treat_var='first_treat',
        controls=['size', 'age'],
        pre_periods=5,
        post_periods=5,
        base_period=-1,
        title="图1 平行趋势检验",
        xlabel="相对于政策实施的时间（年）",
        ylabel="估计系数",
    )

    fig.savefig('parallel_trends_example.png', dpi=300, bbox_inches='tight')
    print("\n图表已保存: parallel_trends_example.png")

    # 也可以手动指定系数绘图
    print("\n" + "=" * 60)
    print("手动指定系数示例")
    print("=" * 60)

    # 模拟的系数和标准误
    manual_coefs = {
        -5: -0.02, -4: 0.01, -3: -0.01, -2: 0.02,
        0: 0.10, 1: 0.15, 2: 0.20, 3: 0.22, 4: 0.25, 5: 0.28
    }
    manual_ses = {
        -5: 0.03, -4: 0.03, -3: 0.03, -2: 0.03,
        0: 0.04, 1: 0.04, 2: 0.04, 3: 0.05, 4: 0.05, 5: 0.05
    }

    fig2 = create_event_study_plot(
        coefficients=manual_coefs,
        std_errors=manual_ses,
        base_period=-1,
        title="图1 平行趋势检验",
        y_range=(-0.15, 0.40),
        y_ticks=[-0.10, 0, 0.10, 0.20, 0.30, 0.40],
    )

    fig2.savefig('parallel_trends_manual.png', dpi=300, bbox_inches='tight')
    print("图表已保存: parallel_trends_manual.png")
