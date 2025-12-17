# Data Analyst Agent

基于 LangChain 1.0 / LangGraph 的数据分析智能体，专为统计学和经济学实证分析设计。

## 功能特性

- **探索性数据分析 (EDA)**: 数据清洗、描述统计、可视化
- **统计分析**: 假设检验、相关分析、回归分析
- **计量经济学方法**: OLS、面板数据、DID、工具变量
- **LaTeX 表格输出**: 生成学术论文格式的回归表格
- **安全代码执行**: E2B 云端沙箱 / 本地 Docker / 开发模式

## 快速开始

### 1. 安装依赖

```bash
cd apps/data-analyst

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

# 安装依赖
pip install -e .
```

### 2. 配置环境变量

```bash
# 复制示例配置
cp .env.example .env

# 编辑 .env 文件，填入你的 API keys
```

**必需的环境变量**（至少设置一个 LLM API）:

```bash
# LLM API (选择一个)
DEEPSEEK_API_KEY="your-deepseek-api-key"      # 推荐，性价比高
ANTHROPIC_API_KEY="your-anthropic-api-key"    # Claude 模型
OPENAI_API_KEY="your-openai-api-key"          # GPT 模型

# 沙箱模式
SANDBOX_MODE="local"    # 开发测试用
# SANDBOX_MODE="e2b"    # 生产环境推荐

# E2B (生产环境需要)
E2B_API_KEY="your-e2b-api-key"

# 可选：Web 搜索
TAVILY_API_KEY="your-tavily-api-key"
```

### 3. 本地测试

```bash
# 快速测试（使用本地执行模式）
export SANDBOX_MODE=local
python run_test.py

# 完整测试
python tests/test_agent.py
```

### 4. 启动 LangGraph 服务器

```bash
# 使用 LangGraph CLI 启动服务器
langgraph dev

# 或指定端口
langgraph dev --port 2024
```

服务器启动后，可以访问:
- API: http://localhost:2024
- LangGraph Studio: http://localhost:2024/studio (如果可用)

### 5. 连接前端

在 `agent-chat-app/apps/web` 目录下启动前端:

```bash
cd ../web
pnpm dev
```

然后在浏览器中:
1. 打开 http://localhost:3000
2. 设置 Deployment URL: `http://localhost:2024`
3. 设置 Assistant ID: `data_analyst`

## 项目结构

```
apps/data-analyst/
├── src/
│   ├── agent/           # 智能体核心
│   │   ├── __init__.py
│   │   └── graph.py     # LangGraph 图定义
│   ├── sandbox/         # 沙箱执行器
│   │   ├── __init__.py
│   │   └── executor.py  # E2B/本地/Docker 执行器
│   └── tools/           # 工具定义
│       ├── __init__.py
│       ├── search.py    # Web 搜索工具
│       └── code_execution.py  # 代码执行工具
├── tests/
│   └── test_agent.py    # 测试脚本
├── langgraph.json       # LangGraph 配置
├── pyproject.toml       # Python 项目配置
├── .env.example         # 环境变量示例
├── run_test.py          # 快速测试脚本
└── README.md
```

## 沙箱模式说明

| 模式 | 设置 | 适用场景 | 安全性 |
|-----|-----|---------|-------|
| **E2B** | `SANDBOX_MODE=e2b` | 生产环境 | 高 |
| **Local** | `SANDBOX_MODE=local` | 开发测试 | 无隔离 |
| **Docker** | `SANDBOX_MODE=docker` | 自托管生产 | 高 |

### E2B 云端沙箱（推荐）

```bash
# 注册 E2B 获取 API key: https://e2b.dev
export E2B_API_KEY="your-key"
export SANDBOX_MODE="e2b"
```

特点:
- 安全隔离的云端执行环境
- 预装数据科学包
- 按需计费（100小时/月免费）

### 本地执行（仅开发）

```bash
export SANDBOX_MODE="local"
```

**警告**: 无安全隔离，仅用于开发测试！

### Docker 执行（自托管）

```bash
export SANDBOX_MODE="docker"
# 需要安装 Docker
```

特点:
- 本地隔离执行
- 适合数据敏感场景
- 需要自己管理 Docker

## API 使用

### Python SDK

```python
from src.agent.graph import invoke, stream

# 同步调用
result = invoke("分析这组数据的相关性: [1,2,3], [4,5,6]", thread_id="my-session")

# 流式调用
for event in stream("运行 OLS 回归分析", thread_id="my-session"):
    print(event)
```

### HTTP API

启动服务器后，可以通过 HTTP 调用:

```bash
# 发送消息
curl -X POST http://localhost:2024/threads/my-thread/runs \
  -H "Content-Type: application/json" \
  -d '{
    "assistant_id": "data_analyst",
    "input": {
      "messages": [{"role": "user", "content": "计算 1+1"}]
    }
  }'
```

## 示例查询

### 基础统计

```
计算 [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] 的均值、中位数和标准差
```

### OLS 回归

```
生成 100 个观测值的模拟数据，包含自变量 X1, X2 和因变量 Y，
然后运行 OLS 回归并生成 LaTeX 格式的结果表格
```

### 面板数据分析

```
创建一个包含 10 个个体、5 个时期的面板数据集，
分别运行固定效应和随机效应模型，并进行 Hausman 检验
```

### DID 分析

```
设计一个 DID 分析：
- 100 个处理组观测值，100 个对照组观测值
- 2 个时期（处理前后）
- 估计处理效应并报告结果
```

## 故障排除

### 常见问题

1. **ModuleNotFoundError: No module named 'src'**
   ```bash
   # 确保在 data-analyst 目录下运行
   cd apps/data-analyst
   pip install -e .
   ```

2. **E2B API Error**
   ```bash
   # 检查 API key 是否正确
   echo $E2B_API_KEY

   # 切换到本地模式测试
   export SANDBOX_MODE=local
   ```

3. **LangGraph 服务器无法启动**
   ```bash
   # 检查 langgraph.json 配置
   cat langgraph.json

   # 确保图定义正确
   python -c "from src.agent.graph import graph; print(graph)"
   ```

4. **前端无法连接**
   - 确保后端运行在正确端口 (默认 2024)
   - 检查 CORS 设置
   - 确认 Assistant ID 为 `data_analyst`

## 下一步

1. **添加更多工具**: 文件上传、数据库连接等
2. **优化提示词**: 针对具体分析任务优化
3. **部署到云端**: AWS/Vercel 部署指南
4. **集成 Deep Agents**: 添加规划和子代理功能

## 许可证

MIT License
