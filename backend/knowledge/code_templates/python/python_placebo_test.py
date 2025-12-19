"""
Python 安慰剂检验图生成模板

实现与 Stata dpplot 等效的核密度分布图：
- 核密度曲线显示模拟系数分布
- 垂直参考线标注真实系数和零值
- 空心圆点样式 (smcircle_hollow)
- 白色背景，s1mono 风格
- 中文标签支持

使用方法：
    from placebo_test import run_placebo_test, create_placebo_plot

    # 方法1：运行完整的安慰剂检验
    results = run_placebo_test(
        df=df,
        y_var='outcome',
        treat_var='treatment',
        controls=['size', 'age'],
        fe_vars=['firm_id', 'year'],
        n_permutations=500,
        permute_var='treatment',  # 'treatment' 或 'post' 或 'both'
        seed=123,
    )
    results['figure'].savefig('placebo_test.png', dpi=300, bbox_inches='tight')

    # 方法2：从已有模拟结果绘图
    fig = create_placebo_plot(
        simulated_coefs=betas,
        true_coef=0.1216,
        title="图7 安慰剂检验",
    )
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from scipy import stats
from typing import Dict, List, Optional, Tuple, Callable
from dataclasses import dataclass
import warnings
from tqdm import tqdm


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

    warnings.warn("No Chinese font found, using default font")
    return None


@dataclass
class PlaceboTestResult:
    """安慰剂检验结果"""
    simulated_coefs: np.ndarray  # 模拟系数
    simulated_ses: np.ndarray  # 模拟标准误
    true_coef: float  # 真实系数
    true_se: float  # 真实标准误
    p_value_permutation: float  # 置换检验p值
    n_permutations: int  # 置换次数
    figure: Optional[plt.Figure] = None


def create_placebo_plot(
    simulated_coefs: np.ndarray,
    true_coef: float,
    title: str = "图7 安慰剂检验",
    xlabel: str = "虚假估计系数",
    ylabel: str = "概率密度",
    figsize: Tuple[float, float] = (8, 6),
    x_range: Optional[Tuple[float, float]] = None,
    x_ticks: Optional[List[float]] = None,
    show_true_coef_line: bool = True,
    show_zero_line: bool = True,
    true_coef_label: str = "真实系数",
    kde_color: str = '#333333',
    kde_fill_color: str = '#cccccc',
    kde_fill_alpha: float = 0.3,
    true_line_color: str = 'black',
    true_line_style: str = '--',
    zero_line_color: str = 'black',
    zero_line_style: str = '-',
    dpi: int = 300,
) -> plt.Figure:
    """
    创建安慰剂检验核密度图（dpplot 风格）

    Args:
        simulated_coefs: 模拟得到的系数数组
        true_coef: 真实回归系数
        title: 图表标题
        xlabel: X轴标签
        ylabel: Y轴标签
        figsize: 图表尺寸
        x_range: X轴范围 (min, max)
        x_ticks: X轴刻度
        show_true_coef_line: 是否显示真实系数参考线
        show_zero_line: 是否显示零线
        true_coef_label: 真实系数标签
        kde_color: 核密度曲线颜色
        kde_fill_color: 核密度填充颜色
        kde_fill_alpha: 核密度填充透明度
        true_line_color: 真实系数线颜色
        true_line_style: 真实系数线样式
        zero_line_color: 零线颜色
        zero_line_style: 零线样式
        dpi: 图像分辨率

    Returns:
        matplotlib Figure 对象
    """
    setup_chinese_font()

    # 创建图形
    fig, ax = plt.subplots(figsize=figsize, dpi=dpi)

    # 设置背景为白色
    ax.set_facecolor('white')
    fig.patch.set_facecolor('white')

    # 计算核密度估计
    simulated_coefs = np.array(simulated_coefs)
    simulated_coefs = simulated_coefs[~np.isnan(simulated_coefs)]

    kde = stats.gaussian_kde(simulated_coefs)

    # 确定x范围
    if x_range is None:
        x_min = min(simulated_coefs.min(), true_coef, 0) * 1.2
        x_max = max(simulated_coefs.max(), true_coef, 0) * 1.2
        x_range = (x_min, x_max)

    x_vals = np.linspace(x_range[0], x_range[1], 500)
    y_vals = kde(x_vals)

    # 绘制核密度曲线
    ax.plot(x_vals, y_vals, color=kde_color, linewidth=1.5, label='核密度估计')

    # 填充核密度区域
    ax.fill_between(x_vals, y_vals, alpha=kde_fill_alpha, color=kde_fill_color)

    # 绘制零线
    if show_zero_line:
        ax.axvline(x=0, color=zero_line_color, linestyle=zero_line_style,
                   linewidth=1.2, label='零值')

    # 绘制真实系数线
    if show_true_coef_line:
        ax.axvline(x=true_coef, color=true_line_color, linestyle=true_line_style,
                   linewidth=1.2, alpha=0.7, label=f'{true_coef_label}: {true_coef:.4f}')

    # 设置X轴
    ax.set_xlim(x_range)
    if x_ticks:
        ax.set_xticks(x_ticks)
        ax.set_xticklabels([f"{t:.2f}" for t in x_ticks])
    ax.set_xlabel(xlabel, fontsize=11)

    # 设置Y轴
    ax.set_ylabel(ylabel, fontsize=11)

    # 设置标题
    ax.set_title(title, fontsize=12, pad=10)

    # 设置边框（s1mono风格）
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_linewidth(0.8)
    ax.spines['bottom'].set_linewidth(0.8)

    # 不显示Y轴网格
    ax.yaxis.grid(False)
    ax.xaxis.grid(False)

    # 添加图例
    ax.legend(loc='upper right', frameon=False, fontsize=9)

    # 添加统计信息
    p_value = np.mean(np.abs(simulated_coefs) >= np.abs(true_coef))
    info_text = f"置换次数: {len(simulated_coefs)}\np值: {p_value:.4f}"
    ax.text(0.02, 0.98, info_text, transform=ax.transAxes,
            fontsize=9, verticalalignment='top',
            bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

    plt.tight_layout()

    return fig


def run_placebo_test(
    df: pd.DataFrame,
    y_var: str,
    treat_var: str,
    post_var: Optional[str] = None,
    did_var: Optional[str] = None,
    controls: Optional[List[str]] = None,
    fe_vars: Optional[List[str]] = None,
    cluster_var: Optional[str] = None,
    n_permutations: int = 500,
    permute_var: str = 'treatment',  # 'treatment', 'post', 或 'both'
    seed: int = 123,
    show_progress: bool = True,
    **plot_kwargs
) -> PlaceboTestResult:
    """
    运行安慰剂检验（置换检验）

    Args:
        df: 面板数据
        y_var: 因变量名
        treat_var: 处理组变量名（0/1）
        post_var: 政策后时期变量名（0/1）,如果提供则构建DID交互项
        did_var: DID交互项变量名（如果已经构建好）
        controls: 控制变量列表
        fe_vars: 固定效应变量列表
        cluster_var: 聚类变量
        n_permutations: 置换次数
        permute_var: 置换哪个变量
            - 'treatment': 随机打乱处理组分配（个体维度）
            - 'post': 随机打乱政策时间（时间维度）
            - 'both': 同时打乱
        seed: 随机种子
        show_progress: 是否显示进度条
        **plot_kwargs: 传递给 create_placebo_plot 的参数

    Returns:
        PlaceboTestResult 对象
    """
    import statsmodels.api as sm

    np.random.seed(seed)

    # 复制数据
    data = df.copy()

    # 确定DID变量
    if did_var is None and post_var is not None:
        data['_did'] = data[treat_var] * data[post_var]
        did_var = '_did'
    elif did_var is None:
        # 假设treat_var就是DID交互项
        did_var = treat_var

    controls = controls or []
    fe_vars = fe_vars or []

    # 准备固定效应虚拟变量
    all_vars = [did_var] + controls
    for fe_var in fe_vars:
        dummies = pd.get_dummies(data[fe_var], prefix=f'fe_{fe_var}', drop_first=True)
        data = pd.concat([data, dummies], axis=1)
        all_vars.extend(dummies.columns.tolist())

    # 首先运行真实回归
    X = data[all_vars].copy()
    X = sm.add_constant(X)
    y = data[y_var]

    valid_mask = ~(X.isna().any(axis=1) | y.isna())
    X_valid = X[valid_mask]
    y_valid = y[valid_mask]
    data_valid = data[valid_mask].copy()

    if cluster_var:
        groups = data_valid[cluster_var]
        true_model = sm.OLS(y_valid, X_valid).fit(cov_type='cluster', cov_kwds={'groups': groups})
    else:
        true_model = sm.OLS(y_valid, X_valid).fit()

    true_coef = true_model.params[did_var]
    true_se = true_model.bse[did_var]

    # 运行置换检验
    simulated_coefs = []
    simulated_ses = []

    iterator = range(n_permutations)
    if show_progress:
        iterator = tqdm(iterator, desc="安慰剂检验")

    for _ in iterator:
        # 置换数据
        perm_data = data_valid.copy()

        if permute_var == 'treatment':
            # 在个体层面随机打乱处理组
            if post_var:
                # 获取唯一个体
                if 'unit_id' in perm_data.columns:
                    unit_var = 'unit_id'
                elif 'firm_id' in perm_data.columns:
                    unit_var = 'firm_id'
                elif 'id' in perm_data.columns:
                    unit_var = 'id'
                else:
                    # 假设数据按个体排序，使用索引
                    unique_treats = perm_data.drop_duplicates(subset=[treat_var])[treat_var].values
                    np.random.shuffle(unique_treats)
                    perm_data[treat_var] = np.random.permutation(perm_data[treat_var].values)

                if 'unit_var' in dir():
                    unit_treat = perm_data.drop_duplicates(subset=[unit_var])[[unit_var, treat_var]].copy()
                    unit_treat[treat_var] = np.random.permutation(unit_treat[treat_var].values)
                    perm_data = perm_data.drop(columns=[treat_var]).merge(unit_treat, on=unit_var)

                perm_data['_did'] = perm_data[treat_var] * perm_data[post_var]
            else:
                perm_data[did_var] = np.random.permutation(perm_data[did_var].values)

        elif permute_var == 'post':
            # 在时间层面随机打乱政策时间
            if post_var:
                perm_data[post_var] = np.random.permutation(perm_data[post_var].values)
                perm_data['_did'] = perm_data[treat_var] * perm_data[post_var]
            else:
                perm_data[did_var] = np.random.permutation(perm_data[did_var].values)

        elif permute_var == 'both':
            # 同时打乱
            perm_data[did_var] = np.random.permutation(perm_data[did_var].values)

        # 重新构建X矩阵
        X_perm = perm_data[all_vars].copy()
        X_perm = sm.add_constant(X_perm)

        try:
            if cluster_var:
                perm_model = sm.OLS(y_valid, X_perm).fit(cov_type='cluster', cov_kwds={'groups': groups})
            else:
                perm_model = sm.OLS(y_valid, X_perm).fit()

            simulated_coefs.append(perm_model.params[did_var])
            simulated_ses.append(perm_model.bse[did_var])
        except Exception:
            continue

    simulated_coefs = np.array(simulated_coefs)
    simulated_ses = np.array(simulated_ses)

    # 计算置换检验p值
    p_value_permutation = np.mean(np.abs(simulated_coefs) >= np.abs(true_coef))

    # 生成图表
    fig = create_placebo_plot(
        simulated_coefs=simulated_coefs,
        true_coef=true_coef,
        **plot_kwargs
    )

    return PlaceboTestResult(
        simulated_coefs=simulated_coefs,
        simulated_ses=simulated_ses,
        true_coef=true_coef,
        true_se=true_se,
        p_value_permutation=p_value_permutation,
        n_permutations=n_permutations,
        figure=fig,
    )


def create_combined_placebo_plot(
    results_list: List[Tuple[np.ndarray, float, str]],
    figsize: Tuple[float, float] = (15, 5),
    **plot_kwargs
) -> plt.Figure:
    """
    创建组合的安慰剂检验图（多个子图）

    Args:
        results_list: [(simulated_coefs, true_coef, title), ...]
        figsize: 图表尺寸
        **plot_kwargs: 传递给子图的参数

    Returns:
        matplotlib Figure 对象
    """
    setup_chinese_font()

    n_plots = len(results_list)
    fig, axes = plt.subplots(1, n_plots, figsize=figsize, dpi=300)

    if n_plots == 1:
        axes = [axes]

    for ax, (simulated_coefs, true_coef, title) in zip(axes, results_list):
        simulated_coefs = np.array(simulated_coefs)
        simulated_coefs = simulated_coefs[~np.isnan(simulated_coefs)]

        # 核密度估计
        kde = stats.gaussian_kde(simulated_coefs)
        x_min = min(simulated_coefs.min(), true_coef, 0) * 1.2
        x_max = max(simulated_coefs.max(), true_coef, 0) * 1.2
        x_vals = np.linspace(x_min, x_max, 500)
        y_vals = kde(x_vals)

        # 绘制
        ax.plot(x_vals, y_vals, color='#333333', linewidth=1.5)
        ax.fill_between(x_vals, y_vals, alpha=0.3, color='#cccccc')
        ax.axvline(x=0, color='black', linestyle='-', linewidth=1.2)
        ax.axvline(x=true_coef, color='black', linestyle='--', linewidth=1.2, alpha=0.7)

        ax.set_xlabel("虚假估计系数", fontsize=11)
        ax.set_ylabel("概率密度", fontsize=11)
        ax.set_title(title, fontsize=12, pad=10)

        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)

        # 统计信息
        p_value = np.mean(np.abs(simulated_coefs) >= np.abs(true_coef))
        ax.text(0.02, 0.98, f"p值: {p_value:.4f}", transform=ax.transAxes,
                fontsize=9, verticalalignment='top')

    fig.patch.set_facecolor('white')
    plt.tight_layout()

    return fig


# 使用示例
if __name__ == "__main__":
    # 生成示例数据
    np.random.seed(42)
    n_units = 200
    n_periods = 10

    units = np.repeat(range(n_units), n_periods)
    periods = np.tile(range(2010, 2010 + n_periods), n_units)

    # 随机分配处理组
    treat = np.repeat(np.random.binomial(1, 0.5, n_units), n_periods)

    # 政策在2015年实施
    post = (periods >= 2015).astype(int)

    # DID交互项
    did = treat * post

    # 固定效应
    unit_fe = np.repeat(np.random.randn(n_units), n_periods)
    time_fe = np.tile(np.random.randn(n_periods), n_units)

    # 真实的处理效应
    true_effect = 0.15

    # 结果变量
    y = 1 + unit_fe + time_fe + true_effect * did + np.random.randn(n_units * n_periods) * 0.5

    df = pd.DataFrame({
        'unit_id': units,
        'year': periods,
        'treat': treat,
        'post': post,
        'did': did,
        'y': y,
        'size': np.random.randn(n_units * n_periods),
    })

    print("=" * 60)
    print("安慰剂检验示例")
    print("=" * 60)

    # 运行安慰剂检验
    result = run_placebo_test(
        df=df,
        y_var='y',
        treat_var='treat',
        post_var='post',
        controls=['size'],
        fe_vars=['unit_id', 'year'],
        n_permutations=500,
        permute_var='treatment',
        seed=123,
        title="图7 安慰剂检验",
        xlabel="虚假估计系数",
        ylabel="概率密度",
    )

    print(f"\n真实系数: {result.true_coef:.4f}")
    print(f"真实标准误: {result.true_se:.4f}")
    print(f"置换检验p值: {result.p_value_permutation:.4f}")
    print(f"置换次数: {result.n_permutations}")

    result.figure.savefig('placebo_test_example.png', dpi=300, bbox_inches='tight')
    print("\n图表已保存: placebo_test_example.png")

    # 也可以直接从已有系数创建图表
    print("\n" + "=" * 60)
    print("直接绘图示例")
    print("=" * 60)

    # 模拟的系数分布
    simulated = np.random.normal(0, 0.05, 500)
    true_coef = 0.12

    fig = create_placebo_plot(
        simulated_coefs=simulated,
        true_coef=true_coef,
        title="图7 安慰剂检验",
        x_range=(-0.2, 0.25),
    )

    fig.savefig('placebo_plot_manual.png', dpi=300, bbox_inches='tight')
    print("图表已保存: placebo_plot_manual.png")
