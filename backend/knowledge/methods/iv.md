# Instrumental Variables (IV) 工具变量法

## 1. 方法概述

工具变量法用于解决内生性问题，当解释变量与误差项相关时（如遗漏变量偏误、反向因果、测量误差），OLS 估计将产生偏误。

### 内生性问题的来源

1. **遗漏变量偏误**：存在同时影响 X 和 Y 的未观测因素
2. **反向因果**：Y 也影响 X
3. **测量误差**：X 的测量存在误差

### 基本设定

**结构方程**：
$$Y_i = \beta_0 + \beta_1 X_i + u_i, \quad Cov(X_i, u_i) \neq 0$$

**第一阶段**：
$$X_i = \pi_0 + \pi_1 Z_i + v_i$$

**约简形式**：
$$Y_i = \gamma_0 + \gamma_1 Z_i + \epsilon_i$$

**IV 估计量**：
$$\hat{\beta}_1^{IV} = \frac{\gamma_1}{\pi_1} = \frac{Cov(Y,Z)}{Cov(X,Z)}$$

## 2. 核心假设

### 2.1 相关性假设（Relevance）

工具变量必须与内生变量显著相关。

$$Cov(Z_i, X_i) \neq 0$$

**检验**：第一阶段 F 统计量 > 10（Stock & Yogo, 2005）

### 2.2 外生性假设（Exogeneity / Exclusion Restriction）

工具变量只能通过内生变量影响结果变量。

$$Cov(Z_i, u_i) = 0$$

**注意**：此假设无法直接检验，需要经济学直觉和理论支持。

### 2.3 单调性假设（Monotonicity，在 LATE 解释下）

工具变量对所有个体的处理效应方向一致（无 Defiers）。

## 3. 估计方法

### 3.1 两阶段最小二乘法（2SLS）

```python
import statsmodels.api as sm
from linearmodels.iv import IV2SLS

# 方法 1：使用 linearmodels
iv_model = IV2SLS.from_formula(
    'y ~ 1 + x2 + [x1 ~ z1 + z2]',
    data=df
).fit(cov_type='clustered', clusters=df['cluster_id'])

print(iv_model.summary)

# 方法 2：手动两阶段
# 第一阶段
stage1 = sm.OLS.from_formula('x1 ~ z1 + z2 + x2', data=df).fit()
df['x1_hat'] = stage1.fittedvalues

# 第二阶段（注意：标准误需要调整）
stage2 = sm.OLS.from_formula('y ~ x1_hat + x2', data=df).fit()
```

### 3.2 广义矩估计（GMM）

当工具变量数量多于内生变量时使用，更有效率。

```python
from linearmodels.iv import IVGMM

gmm_model = IVGMM.from_formula(
    'y ~ 1 + x2 + [x1 ~ z1 + z2 + z3]',
    data=df
).fit()
```

## 4. 诊断检验

### 4.1 弱工具变量检验

```python
# 第一阶段 F 统计量
from linearmodels.iv import IV2SLS

model = IV2SLS.from_formula('y ~ 1 + [x1 ~ z1 + z2]', data=df).fit()
print(f"First Stage F-stat: {model.first_stage.diagnostics['f.stat']}")

# 判断标准
# F > 10: 工具变量强度可接受
# F < 10: 存在弱工具变量问题
```

**弱工具变量的后果**：
- 2SLS 估计量有偏（向 OLS 偏倚）
- 标准误低估
- 置信区间覆盖率不准确

**解决方案**：
- LIML 估计量（弱工具变量下表现更好）
- Anderson-Rubin 置信区间
- 寻找更强的工具变量

### 4.2 过度识别检验（Overidentification Test）

当工具变量数量 > 内生变量数量时，可以检验额外工具变量的有效性。

```python
# Sargan-Hansen J 检验
# H0: 所有工具变量都外生
# 拒绝 H0 表明至少一个工具变量无效

print(f"Sargan-Hansen J-stat: {model.j_stat.stat}")
print(f"p-value: {model.j_stat.pval}")
```

**注意**：
- 此检验只能检测工具变量之间的不一致性
- 如果所有工具变量都内生但方向一致，检验会通过
- 不能替代经济学理论论证

### 4.3 内生性检验（Hausman 检验）

检验是否确实需要 IV（即 X 是否真的内生）。

```python
# Durbin-Wu-Hausman 检验
# H0: X 是外生的（OLS 一致）
# 拒绝 H0 表明需要使用 IV

print(f"Durbin-Wu-Hausman: {model.wu_hausman.stat}")
print(f"p-value: {model.wu_hausman.pval}")
```

## 5. 常见工具变量类型

### 5.1 自然实验

- 政策变化、法律改革
- 地理边界断点
- 历史事件

### 5.2 Shift-Share 工具变量（Bartik IV）

用于研究某种冲击对地区的影响：

$$Z_i = \sum_j s_{ij} \cdot g_j$$

其中 $s_{ij}$ 是地区 $i$ 行业 $j$ 的初始份额，$g_j$ 是行业 $j$ 的全国增长率。

**关键假设**：初始份额外生（Goldsmith-Pinkham et al., 2020）

### 5.3 其他常见 IV

- 距离（对消费、使用的影响）
- 天气（对农业、户外活动的影响）
- 同群效应（Peer effects）
- 父母变量（教育回报研究）

## 6. 结果解读

### LATE vs ATE

IV 估计的是**局部平均处理效应（LATE）**，即受工具变量影响而改变处理状态的群体（Compliers）的处理效应。

$$LATE = E[Y_i(1) - Y_i(0) | Complier]$$

**重要**：LATE 可能与 ATE 不同，需要讨论外部有效性。

### 报告规范

1. **经济学论证**：详细说明为什么工具变量满足外生性
2. **第一阶段结果**：F 统计量、系数、显著性
3. **主回归结果**：IV 估计量、标准误
4. **诊断检验**：弱工具变量检验、过度识别检验
5. **OLS 对比**：讨论 IV 与 OLS 的差异及原因

## 7. 常见错误

1. **只报告 IV 不报告第一阶段**
2. **忽视弱工具变量问题**
3. **缺乏外生性的经济学论证**
4. **过度依赖统计检验**
5. **将 LATE 过度推广为 ATE**

## 8. 代码模板

```python
import pandas as pd
import statsmodels.api as sm
from linearmodels.iv import IV2SLS

def run_iv_analysis(df, y_var, endog_var, exog_vars, instruments, cluster_var=None):
    """
    执行完整的 IV 分析

    Parameters:
    -----------
    df : DataFrame
    y_var : str, 因变量
    endog_var : str, 内生变量
    exog_vars : list, 外生控制变量
    instruments : list, 工具变量
    cluster_var : str, 聚类变量

    Returns:
    --------
    dict with OLS and IV results
    """
    # 构建公式
    exog_str = ' + '.join(exog_vars) if exog_vars else '1'
    iv_formula = f'{y_var} ~ {exog_str} + [{endog_var} ~ {" + ".join(instruments)}]'
    ols_formula = f'{y_var} ~ {endog_var} + {exog_str}'

    # OLS 估计
    ols_model = sm.OLS.from_formula(ols_formula, data=df).fit(
        cov_type='cluster' if cluster_var else 'HC1',
        cov_kwds={'groups': df[cluster_var]} if cluster_var else {}
    )

    # IV 估计
    iv_model = IV2SLS.from_formula(iv_formula, data=df).fit(
        cov_type='clustered' if cluster_var else 'robust',
        clusters=df[cluster_var] if cluster_var else None
    )

    # 打印诊断信息
    print("=" * 60)
    print("IV Analysis Results")
    print("=" * 60)
    print(f"\nFirst Stage F-stat: {iv_model.first_stage.diagnostics['f.stat']:.2f}")
    print(f"Weak IV threshold: 10.0")
    print(f"\nOLS estimate: {ols_model.params[endog_var]:.4f} ({ols_model.bse[endog_var]:.4f})")
    print(f"IV estimate:  {iv_model.params[endog_var]:.4f} ({iv_model.std_errors[endog_var]:.4f})")

    if hasattr(iv_model, 'j_stat') and iv_model.j_stat is not None:
        print(f"\nOveridentification J-stat: {iv_model.j_stat.stat:.2f} (p={iv_model.j_stat.pval:.3f})")

    print(f"\nHausman test: {iv_model.wu_hausman.stat:.2f} (p={iv_model.wu_hausman.pval:.3f})")

    return {'ols': ols_model, 'iv': iv_model}
```

## 9. 参考文献

- Angrist, J. D., & Pischke, J. S. (2009). Mostly Harmless Econometrics
- Stock, J. H., & Yogo, M. (2005). Testing for Weak Instruments
- Goldsmith-Pinkham, P., Sorkin, I., & Swift, H. (2020). Bartik Instruments
- Imbens, G. W. (2014). Instrumental Variables: An Econometrician's Perspective
