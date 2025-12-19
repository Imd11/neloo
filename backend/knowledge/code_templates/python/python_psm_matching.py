"""
Python PSM（倾向得分匹配）模板

实现与 Stata psmatch2 + pstest 等效的功能：
- 倾向得分估计（Logit）
- 多种匹配方法：近邻匹配、核匹配、半径匹配
- 平衡性检验表格
- 倾向得分核密度图（匹配前后对比）
- 支持逐年匹配

使用方法：
    from psm_matching import run_psm, create_balance_plot, create_pscore_density_plot

    # 运行PSM匹配
    result = run_psm(
        df=df,
        treat_var='treat',
        covariates=['size', 'age', 'lev'],
        method='kernel',  # 'neighbor', 'kernel', 'radius'
        n_neighbors=1,
        caliper=0.05,
    )

    # 查看平衡性检验结果
    print(result.balance_table)

    # 绘制核密度图
    fig = create_pscore_density_plot(result)
    fig.savefig('pscore_density.png', dpi=300)
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from scipy import stats
from typing import Dict, List, Optional, Tuple, Literal
from dataclasses import dataclass
import warnings
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import NearestNeighbors


# 设置中文字体
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
class PSMResult:
    """PSM匹配结果"""
    matched_data: pd.DataFrame  # 匹配后的数据
    pscore: pd.Series  # 倾向得分
    weights: pd.Series  # 匹配权重
    balance_table: pd.DataFrame  # 平衡性检验表
    n_treated: int  # 处理组样本量
    n_control_before: int  # 匹配前控制组样本量
    n_control_after: int  # 匹配后控制组样本量（加权）
    on_support: pd.Series  # 是否在支撑域内
    method: str  # 匹配方法


def estimate_propensity_score(
    df: pd.DataFrame,
    treat_var: str,
    covariates: List[str],
    standardize: bool = True,
) -> pd.Series:
    """
    使用Logit模型估计倾向得分

    Args:
        df: 数据框
        treat_var: 处理变量名
        covariates: 协变量列表
        standardize: 是否标准化协变量

    Returns:
        倾向得分 Series
    """
    # 准备数据
    X = df[covariates].copy()
    y = df[treat_var].copy()

    # 处理缺失值
    valid_mask = ~(X.isna().any(axis=1) | y.isna())
    X = X[valid_mask]
    y = y[valid_mask]

    if standardize:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
    else:
        X_scaled = X.values

    # 估计Logit模型
    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(X_scaled, y)

    # 预测概率
    pscore = pd.Series(index=df.index, dtype=float)
    pscore[valid_mask] = model.predict_proba(X_scaled)[:, 1]

    return pscore


def nearest_neighbor_matching(
    pscore: pd.Series,
    treat: pd.Series,
    n_neighbors: int = 1,
    caliper: Optional[float] = None,
    with_replacement: bool = True,
) -> Tuple[pd.Series, pd.Series]:
    """
    近邻匹配

    Args:
        pscore: 倾向得分
        treat: 处理变量
        n_neighbors: 近邻数
        caliper: 卡尺（最大匹配距离）
        with_replacement: 是否有放回匹配

    Returns:
        (weights, on_support)
    """
    # 分离处理组和控制组
    treated_idx = treat[treat == 1].index
    control_idx = treat[treat == 0].index

    treated_pscore = pscore[treated_idx].values.reshape(-1, 1)
    control_pscore = pscore[control_idx].values.reshape(-1, 1)

    # 使用最近邻搜索
    nn = NearestNeighbors(n_neighbors=n_neighbors, metric='euclidean')
    nn.fit(control_pscore)

    distances, indices = nn.kneighbors(treated_pscore)

    # 初始化权重
    weights = pd.Series(0.0, index=pscore.index)
    on_support = pd.Series(True, index=pscore.index)

    # 处理组权重为1
    weights[treated_idx] = 1.0

    # 计算控制组权重
    control_weights = np.zeros(len(control_idx))

    for i, (dists, idxs) in enumerate(zip(distances, indices)):
        # 应用卡尺
        if caliper is not None:
            valid_matches = dists <= caliper
            if not valid_matches.any():
                on_support[treated_idx[i]] = False
                continue
            idxs = idxs[valid_matches]

        for idx in idxs:
            control_weights[idx] += 1.0 / n_neighbors

    # 归一化权重
    if control_weights.sum() > 0:
        control_weights = control_weights / control_weights.sum() * len(treated_idx)

    weights[control_idx] = control_weights

    return weights, on_support


def kernel_matching(
    pscore: pd.Series,
    treat: pd.Series,
    bandwidth: Optional[float] = None,
) -> Tuple[pd.Series, pd.Series]:
    """
    核匹配（Epanechnikov核）

    Args:
        pscore: 倾向得分
        treat: 处理变量
        bandwidth: 带宽（如果为None，使用Silverman规则）

    Returns:
        (weights, on_support)
    """
    treated_idx = treat[treat == 1].index
    control_idx = treat[treat == 0].index

    treated_pscore = pscore[treated_idx].values
    control_pscore = pscore[control_idx].values

    # 计算带宽（Silverman规则）
    if bandwidth is None:
        std = pscore.std()
        iqr = pscore.quantile(0.75) - pscore.quantile(0.25)
        bandwidth = 0.9 * min(std, iqr / 1.34) * (len(pscore) ** (-0.2))

    # Epanechnikov 核函数
    def epanechnikov(u):
        return np.where(np.abs(u) <= 1, 0.75 * (1 - u**2), 0)

    # 初始化权重
    weights = pd.Series(0.0, index=pscore.index)
    on_support = pd.Series(True, index=pscore.index)

    # 处理组权重为1
    weights[treated_idx] = 1.0

    # 计算控制组权重
    control_weights = np.zeros(len(control_idx))

    for treated_ps in treated_pscore:
        # 计算每个控制组观测的核权重
        u = (control_pscore - treated_ps) / bandwidth
        kernel_weights = epanechnikov(u)

        if kernel_weights.sum() > 0:
            kernel_weights = kernel_weights / kernel_weights.sum()
            control_weights += kernel_weights

    # 归一化
    if control_weights.sum() > 0:
        control_weights = control_weights / control_weights.sum() * len(treated_idx)

    weights[control_idx] = control_weights

    return weights, on_support


def calculate_balance_table(
    df: pd.DataFrame,
    treat_var: str,
    covariates: List[str],
    weights: Optional[pd.Series] = None,
    include_pscore: bool = True,
    pscore: Optional[pd.Series] = None,
) -> pd.DataFrame:
    """
    计算平衡性检验表（类似Stata pstest）

    Args:
        df: 数据框
        treat_var: 处理变量名
        covariates: 协变量列表
        weights: 匹配权重
        include_pscore: 是否包含倾向得分
        pscore: 倾向得分

    Returns:
        平衡性检验表
    """
    results = []

    vars_to_check = covariates.copy()
    if include_pscore and pscore is not None:
        df = df.copy()
        df['_pscore'] = pscore
        vars_to_check.append('_pscore')

    treat = df[treat_var]

    for var in vars_to_check:
        row = {'Variable': var if var != '_pscore' else 'Propensity Score'}

        # 匹配前
        treated_before = df.loc[treat == 1, var]
        control_before = df.loc[treat == 0, var]

        mean_t_before = treated_before.mean()
        mean_c_before = control_before.mean()
        std_before = np.sqrt((treated_before.var() + control_before.var()) / 2)

        if std_before > 0:
            std_diff_before = 100 * (mean_t_before - mean_c_before) / std_before
        else:
            std_diff_before = 0

        row['Mean_Treated'] = mean_t_before
        row['Mean_Control_Before'] = mean_c_before
        row['Std_Diff_Before'] = std_diff_before

        # t检验（匹配前）
        t_stat_before, p_val_before = stats.ttest_ind(
            treated_before.dropna(), control_before.dropna()
        )
        row['t_Before'] = t_stat_before
        row['p_Before'] = p_val_before

        # 匹配后（加权）
        if weights is not None:
            weighted_control = df.loc[treat == 0, var] * weights[treat == 0]
            weight_sum = weights[treat == 0].sum()

            if weight_sum > 0:
                mean_c_after = weighted_control.sum() / weight_sum

                # 加权方差
                weighted_var = ((df.loc[treat == 0, var] - mean_c_after) ** 2 * weights[treat == 0]).sum() / weight_sum
                std_after = np.sqrt((treated_before.var() + weighted_var) / 2)

                if std_after > 0:
                    std_diff_after = 100 * (mean_t_before - mean_c_after) / std_after
                else:
                    std_diff_after = 0

                row['Mean_Control_After'] = mean_c_after
                row['Std_Diff_After'] = std_diff_after

                # 偏差减少百分比
                if abs(std_diff_before) > 0:
                    row['Bias_Reduction'] = 100 * (1 - abs(std_diff_after) / abs(std_diff_before))
                else:
                    row['Bias_Reduction'] = np.nan

        results.append(row)

    return pd.DataFrame(results)


def run_psm(
    df: pd.DataFrame,
    treat_var: str,
    covariates: List[str],
    method: Literal['neighbor', 'kernel', 'radius'] = 'kernel',
    n_neighbors: int = 1,
    caliper: Optional[float] = None,
    bandwidth: Optional[float] = None,
    common_support: bool = True,
    standardize: bool = True,
) -> PSMResult:
    """
    运行倾向得分匹配

    Args:
        df: 面板数据
        treat_var: 处理变量名（0/1）
        covariates: 协变量列表
        method: 匹配方法
            - 'neighbor': 近邻匹配
            - 'kernel': 核匹配
            - 'radius': 半径匹配（近邻+卡尺）
        n_neighbors: 近邻数（用于neighbor和radius方法）
        caliper: 卡尺（最大匹配距离）
        bandwidth: 核匹配带宽
        common_support: 是否限制在共同支撑域
        standardize: 是否标准化协变量

    Returns:
        PSMResult 对象
    """
    data = df.copy()

    # 估计倾向得分
    pscore = estimate_propensity_score(data, treat_var, covariates, standardize)
    data['_pscore'] = pscore

    # 共同支撑域
    on_support = pd.Series(True, index=data.index)
    if common_support:
        treat = data[treat_var]
        ps_treated = pscore[treat == 1]
        ps_control = pscore[treat == 0]

        min_common = max(ps_treated.min(), ps_control.min())
        max_common = min(ps_treated.max(), ps_control.max())

        on_support = (pscore >= min_common) & (pscore <= max_common) & ~pscore.isna()

    # 在支撑域内执行匹配
    data_support = data[on_support].copy()
    pscore_support = pscore[on_support]
    treat_support = data_support[treat_var]

    # 执行匹配
    if method == 'neighbor':
        weights, match_support = nearest_neighbor_matching(
            pscore_support, treat_support, n_neighbors, caliper, with_replacement=True
        )
    elif method == 'radius':
        weights, match_support = nearest_neighbor_matching(
            pscore_support, treat_support, n_neighbors, caliper, with_replacement=True
        )
    elif method == 'kernel':
        weights, match_support = kernel_matching(
            pscore_support, treat_support, bandwidth
        )
    else:
        raise ValueError(f"Unknown method: {method}")

    # 更新支撑状态
    on_support_full = pd.Series(False, index=data.index)
    on_support_full[on_support] = match_support

    # 创建完整权重
    weights_full = pd.Series(0.0, index=data.index)
    weights_full[on_support] = weights

    # 计算平衡性检验表
    balance_table = calculate_balance_table(
        data[on_support_full],
        treat_var,
        covariates,
        weights_full[on_support_full],
        include_pscore=True,
        pscore=pscore[on_support_full],
    )

    # 准备匹配后数据
    matched_data = data.copy()
    matched_data['_weight'] = weights_full
    matched_data['_support'] = on_support_full

    return PSMResult(
        matched_data=matched_data,
        pscore=pscore,
        weights=weights_full,
        balance_table=balance_table,
        n_treated=int((data[treat_var] == 1).sum()),
        n_control_before=int((data[treat_var] == 0).sum()),
        n_control_after=int(weights_full[data[treat_var] == 0].sum()),
        on_support=on_support_full,
        method=method,
    )


def create_pscore_density_plot(
    result: PSMResult,
    treat_var: str = 'treat',
    figsize: Tuple[float, float] = (12, 5),
    title_before: str = "匹配前的倾向得分分布",
    title_after: str = "匹配后的倾向得分分布",
    xlabel: str = "倾向得分值",
    ylabel: str = "核密度",
    treat_label: str = "处理组",
    control_label: str = "控制组",
    treat_color: str = 'black',
    control_color: str = 'black',
    treat_style: str = '-',
    control_style: str = '--',
    dpi: int = 300,
) -> plt.Figure:
    """
    创建倾向得分核密度图（匹配前后对比）

    Args:
        result: PSM匹配结果
        treat_var: 处理变量名
        figsize: 图表尺寸
        title_before: 匹配前标题
        title_after: 匹配后标题
        xlabel: X轴标签
        ylabel: Y轴标签
        treat_label: 处理组标签
        control_label: 控制组标签
        treat_color: 处理组颜色
        control_color: 控制组颜色
        treat_style: 处理组线型
        control_style: 控制组线型
        dpi: 图像分辨率

    Returns:
        matplotlib Figure 对象
    """
    setup_chinese_font()

    fig, axes = plt.subplots(1, 2, figsize=figsize, dpi=dpi)

    data = result.matched_data
    pscore = result.pscore
    weights = result.weights
    on_support = result.on_support

    treat = data[treat_var]

    # 匹配前
    ax = axes[0]

    ps_treated = pscore[treat == 1].dropna()
    ps_control = pscore[treat == 0].dropna()

    if len(ps_treated) > 1:
        kde_treated = stats.gaussian_kde(ps_treated)
        x_vals = np.linspace(0, 1, 200)
        ax.plot(x_vals, kde_treated(x_vals), color=treat_color, linestyle=treat_style,
                linewidth=1.5, label=treat_label)

    if len(ps_control) > 1:
        kde_control = stats.gaussian_kde(ps_control)
        ax.plot(x_vals, kde_control(x_vals), color=control_color, linestyle=control_style,
                linewidth=1.5, label=control_label)

    # 添加均值参考线
    ax.axvline(x=ps_treated.mean(), color=treat_color, linestyle=treat_style,
               linewidth=0.8, alpha=0.5)
    ax.axvline(x=ps_control.mean(), color=control_color, linestyle=control_style,
               linewidth=0.8, alpha=0.5)

    ax.set_xlabel(xlabel, fontsize=11)
    ax.set_ylabel(ylabel, fontsize=11)
    ax.set_title(title_before, fontsize=12)
    ax.legend(loc='upper right', frameon=False)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    # 匹配后
    ax = axes[1]

    # 处理组（在支撑域内）
    ps_treated_after = pscore[(treat == 1) & on_support].dropna()

    # 控制组（加权）
    control_mask = (treat == 0) & on_support & (weights > 0)
    ps_control_after = pscore[control_mask]
    weights_control = weights[control_mask]

    if len(ps_treated_after) > 1:
        kde_treated = stats.gaussian_kde(ps_treated_after)
        ax.plot(x_vals, kde_treated(x_vals), color=treat_color, linestyle=treat_style,
                linewidth=1.5, label=treat_label)

    if len(ps_control_after) > 1 and weights_control.sum() > 0:
        # 加权核密度估计
        kde_control_weighted = stats.gaussian_kde(
            ps_control_after.values,
            weights=weights_control.values / weights_control.sum()
        )
        ax.plot(x_vals, kde_control_weighted(x_vals), color=control_color, linestyle=control_style,
                linewidth=1.5, label=control_label)

    # 添加均值参考线
    ax.axvline(x=ps_treated_after.mean(), color=treat_color, linestyle=treat_style,
               linewidth=0.8, alpha=0.5)

    if len(ps_control_after) > 0 and weights_control.sum() > 0:
        weighted_mean = (ps_control_after * weights_control).sum() / weights_control.sum()
        ax.axvline(x=weighted_mean, color=control_color, linestyle=control_style,
                   linewidth=0.8, alpha=0.5)

    ax.set_xlabel(xlabel, fontsize=11)
    ax.set_ylabel(ylabel, fontsize=11)
    ax.set_title(title_after, fontsize=12)
    ax.legend(loc='upper right', frameon=False)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    fig.patch.set_facecolor('white')
    plt.tight_layout()

    return fig


def format_balance_table(
    balance_table: pd.DataFrame,
    decimal: int = 4,
) -> str:
    """
    格式化平衡性检验表为文本输出

    Args:
        balance_table: 平衡性检验表
        decimal: 小数位数

    Returns:
        格式化的表格字符串
    """
    lines = []
    lines.append("=" * 90)
    lines.append("平衡性检验结果 (Balance Test)")
    lines.append("=" * 90)

    # 表头
    header = f"{'Variable':<20} {'Mean T':>10} {'Mean C(B)':>10} {'Mean C(A)':>10} {'%Bias(B)':>10} {'%Bias(A)':>10} {'%Reduce':>10}"
    lines.append(header)
    lines.append("-" * 90)

    for _, row in balance_table.iterrows():
        var = row['Variable'][:18]
        mean_t = f"{row['Mean_Treated']:.{decimal}f}"
        mean_cb = f"{row['Mean_Control_Before']:.{decimal}f}"
        mean_ca = f"{row.get('Mean_Control_After', np.nan):.{decimal}f}" if pd.notna(row.get('Mean_Control_After')) else "N/A"
        bias_b = f"{row['Std_Diff_Before']:.1f}"
        bias_a = f"{row.get('Std_Diff_After', np.nan):.1f}" if pd.notna(row.get('Std_Diff_After')) else "N/A"
        reduce = f"{row.get('Bias_Reduction', np.nan):.1f}" if pd.notna(row.get('Bias_Reduction')) else "N/A"

        line = f"{var:<20} {mean_t:>10} {mean_cb:>10} {mean_ca:>10} {bias_b:>10} {bias_a:>10} {reduce:>10}"
        lines.append(line)

    lines.append("=" * 90)
    lines.append("注: T=处理组, C(B)=匹配前控制组, C(A)=匹配后控制组, %Bias=标准化偏差, %Reduce=偏差减少比例")

    return "\n".join(lines)


# 使用示例
if __name__ == "__main__":
    # 生成示例数据
    np.random.seed(42)
    n = 1000

    # 协变量
    size = np.random.randn(n)
    age = np.random.randn(n)
    lev = np.random.randn(n)

    # 处理分配（与协变量相关）
    propensity = 0.3 + 0.3 * size + 0.2 * age - 0.1 * lev
    propensity = 1 / (1 + np.exp(-propensity))
    treat = np.random.binomial(1, propensity)

    # 结果变量
    y = 1 + 0.5 * size + 0.3 * age - 0.2 * lev + 0.8 * treat + np.random.randn(n) * 0.5

    df = pd.DataFrame({
        'treat': treat,
        'size': size,
        'age': age,
        'lev': lev,
        'y': y,
    })

    print("=" * 60)
    print("PSM 匹配示例")
    print("=" * 60)

    # 运行核匹配
    result = run_psm(
        df=df,
        treat_var='treat',
        covariates=['size', 'age', 'lev'],
        method='kernel',
    )

    print(f"\n匹配方法: {result.method}")
    print(f"处理组样本量: {result.n_treated}")
    print(f"匹配前控制组样本量: {result.n_control_before}")
    print(f"匹配后控制组有效样本量: {result.n_control_after}")

    print("\n" + format_balance_table(result.balance_table))

    # 绘制核密度图
    fig = create_pscore_density_plot(
        result,
        treat_var='treat',
        title_before="匹配前的倾向得分分布",
        title_after="匹配后的倾向得分分布",
    )

    fig.savefig('psm_density_example.png', dpi=300, bbox_inches='tight')
    print("\n图表已保存: psm_density_example.png")

    # 近邻匹配
    print("\n" + "=" * 60)
    print("近邻匹配 (n=1, caliper=0.05)")
    print("=" * 60)

    result_nn = run_psm(
        df=df,
        treat_var='treat',
        covariates=['size', 'age', 'lev'],
        method='neighbor',
        n_neighbors=1,
        caliper=0.05,
    )

    print(format_balance_table(result_nn.balance_table))
