# Difference-in-Differences (DID) 双重差分法

## 1. 方法概述

双重差分法是评估政策效应或处理效应最常用的准自然实验方法之一。其核心思想是通过比较处理组和对照组在政策实施前后的变化差异，消除时间趋势和组别固定差异的影响。

### 基本设定

- **处理组（Treatment Group）**：受到政策/干预影响的个体
- **对照组（Control Group）**：未受到政策影响的个体
- **处理前期（Pre-treatment）**：政策实施前的时期
- **处理后期（Post-treatment）**：政策实施后的时期

### 基准回归模型

$$Y_{it} = \alpha + \beta_1 \cdot Treat_i + \beta_2 \cdot Post_t + \beta_3 \cdot (Treat_i \times Post_t) + \epsilon_{it}$$

其中：
- $Y_{it}$：个体 $i$ 在时期 $t$ 的结果变量
- $Treat_i$：处理组虚拟变量（处理组=1，对照组=0）
- $Post_t$：时期虚拟变量（政策后=1，政策前=0）
- $\beta_3$：**DID 估计量**，即政策的因果效应

## 2. 核心假设

### 2.1 平行趋势假设（Parallel Trends Assumption）

**最关键的假设**：在没有政策干预的情况下，处理组和对照组的结果变量应该遵循相同的时间趋势。

$$E[Y_{it}(0) | Treat_i = 1] - E[Y_{it}(0) | Treat_i = 0] = \text{常数}$$

#### 检验方法

1. **可视化检验**：绘制处理组和对照组在政策前的趋势图
2. **事件研究法（Event Study）**：

```python
# 事件研究回归
# Y_it = α + Σ_k β_k × Treat_i × D_k + γ_i + δ_t + ε_it
# 其中 D_k 是相对于政策实施时点的时期虚拟变量

import pandas as pd
import statsmodels.formula.api as smf

# 生成相对时间变量
df['rel_time'] = df['year'] - df['treat_year']

# 创建时期虚拟变量与处理组的交互项
for k in range(-4, 5):  # 政策前4期到政策后4期
    if k != -1:  # 以-1期为基准
        df[f'treat_rel{k}'] = (df['treat'] == 1) & (df['rel_time'] == k)

# 事件研究回归
formula = 'y ~ ' + ' + '.join([f'treat_rel{k}' for k in range(-4, 5) if k != -1])
formula += ' + C(id) + C(year)'
model = smf.ols(formula, data=df).fit(cov_type='cluster', cov_kwds={'groups': df['id']})
```

3. **安慰剂检验**：使用假的政策时点进行检验

### 2.2 无预期效应（No Anticipation）

处理组在政策实施前不应该提前改变行为。如果事件研究显示政策前系数显著不为零，可能违反此假设。

### 2.3 稳定单位处理假设（SUTVA）

- 个体的潜在结果不受其他个体处理状态的影响（无溢出效应）
- 处理是同质的

## 3. 实施步骤

### 步骤 1：数据准备

```python
import pandas as pd
import numpy as np

# 确保数据是面板结构
df = df.sort_values(['id', 'year'])

# 创建处理组和时期变量
df['treat'] = (df['group'] == 'treatment').astype(int)
df['post'] = (df['year'] >= policy_year).astype(int)
df['did'] = df['treat'] * df['post']
```

### 步骤 2：描述性统计

```python
# 分组描述
print("处理组 vs 对照组 基期均值比较:")
baseline = df[df['year'] < policy_year].groupby('treat')['y'].agg(['mean', 'std', 'count'])
print(baseline)

# 检查样本平衡
print("\n协变量平衡性检验:")
for var in ['x1', 'x2', 'x3']:
    diff = df[df['treat']==1][var].mean() - df[df['treat']==0][var].mean()
    print(f"{var}: 差异 = {diff:.4f}")
```

### 步骤 3：可视化平行趋势

```python
import matplotlib.pyplot as plt

# 计算分组年度均值
trends = df.groupby(['year', 'treat'])['y'].mean().unstack()

plt.figure(figsize=(10, 6))
plt.plot(trends.index, trends[0], 'b-o', label='Control')
plt.plot(trends.index, trends[1], 'r-s', label='Treatment')
plt.axvline(x=policy_year, color='gray', linestyle='--', label='Policy')
plt.xlabel('Year')
plt.ylabel('Outcome')
plt.legend()
plt.title('Parallel Trends Check')
plt.show()
```

### 步骤 4：基准回归

```python
import statsmodels.formula.api as smf

# 基准 DID
model1 = smf.ols('y ~ treat + post + did', data=df).fit(
    cov_type='cluster',
    cov_kwds={'groups': df['id']}
)

# 双向固定效应
model2 = smf.ols('y ~ did + C(id) + C(year)', data=df).fit(
    cov_type='cluster',
    cov_kwds={'groups': df['id']}
)

print(f"DID 估计量: {model2.params['did']:.4f}")
print(f"标准误: {model2.bse['did']:.4f}")
print(f"p值: {model2.pvalues['did']:.4f}")
```

### 步骤 5：稳健性检验

1. **控制变量稳健性**
2. **样本稳健性**（排除异常值、改变样本期间）
3. **安慰剂检验**
4. **不同聚类层级**

## 4. 常见问题与解决方案

### 问题 1：平行趋势不成立

**解决方案**：
- 匹配方法（PSM-DID）
- 合成控制法
- 三重差分（DDD）
- 控制组别特定时间趋势

### 问题 2：处理时点异质性（Staggered DID）

当不同个体在不同时点接受处理时，传统双向固定效应可能产生偏误。

**解决方案**：
- Callaway & Sant'Anna (2021) 估计量
- Sun & Abraham (2021) 估计量
- Borusyak, Jaravel & Spiess (2024) 估计量

```python
# 使用 did 包（如果可用）或手动实现
# 核心思想：避免"已处理"组作为对照组

# 简化的 Staggered DID 处理
# 1. 识别处理时点
# 2. 按处理批次分组
# 3. 对每个批次单独估计，再加权平均
```

### 问题 3：选择性进入处理

如果个体基于潜在结果选择进入处理组，DID 估计将有偏。

**检验**：
- 检验可观测特征的平衡性
- 检验政策前趋势

## 5. 结果汇报规范

### 必须汇报的内容

1. **样本说明**：处理组/对照组数量、时间跨度
2. **平行趋势检验结果**：图表 + 事件研究系数
3. **基准回归结果**：系数、标准误、显著性
4. **稳健性检验**：至少包含安慰剂检验
5. **标准误说明**：聚类层级

### 结果表格格式示例

| | (1) | (2) | (3) | (4) |
|---|---|---|---|---|
| DID | 0.123*** | 0.118*** | 0.115*** | 0.120*** |
| | (0.032) | (0.030) | (0.028) | (0.029) |
| 控制变量 | No | Yes | Yes | Yes |
| 个体固定效应 | No | No | Yes | Yes |
| 时间固定效应 | No | No | Yes | Yes |
| N | 10,000 | 10,000 | 10,000 | 9,500 |
| R² | 0.05 | 0.12 | 0.45 | 0.46 |

注：括号内为聚类稳健标准误（聚类至个体层面）。*** p<0.01, ** p<0.05, * p<0.1

## 6. 参考文献

- Angrist, J. D., & Pischke, J. S. (2009). Mostly Harmless Econometrics
- Cunningham, S. (2021). Causal Inference: The Mixtape
- Goodman-Bacon, A. (2021). Difference-in-differences with variation in treatment timing
- Callaway, B., & Sant'Anna, P. H. (2021). Difference-in-differences with multiple time periods
