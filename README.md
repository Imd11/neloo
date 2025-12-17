# Data Analyst Agent

基于 LangChain 1.0 / LangGraph 的数据分析智能体，专为统计学和经济学实证分析设计。

## 项目结构

```
data-analyst/
├── backend/              # Python 后端 (LangGraph Agent)
│   ├── src/
│   │   ├── agent/        # Agent 核心逻辑
│   │   ├── sandbox/      # 代码执行沙箱
│   │   └── tools/        # 工具定义
│   ├── langgraph.json    # LangGraph 配置
│   └── pyproject.toml    # Python 依赖
│
├── frontend/             # Next.js 前端
│   ├── src/
│   │   ├── app/          # 页面
│   │   ├── components/   # UI 组件
│   │   └── providers/    # 状态管理
│   └── package.json      # Node.js 依赖
│
└── README.md             # 本文件
```

## 功能特性

- **探索性数据分析 (EDA)**: 数据清洗、描述统计、可视化
- **统计分析**: 假设检验、相关分析、回归分析
- **计量经济学方法**: OLS、面板数据、DID、工具变量
- **LaTeX 表格输出**: 生成学术论文格式的回归表格
- **安全代码执行**: E2B 云端沙箱 / 本地 Docker / 开发模式

## 快速开始

### 1. 启动后端

```bash
cd backend

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

# 安装依赖
pip install -e .

# 启动 LangGraph 服务器
langgraph dev --port 2024
```

### 2. 启动前端

```bash
cd frontend

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

### 3. 访问应用

打开浏览器访问 http://localhost:3000

## 环境变量配置

### 后端 (backend/.env)

```bash
# LLM API (选择一个)
DEEPSEEK_API_KEY="your-key"      # 推荐
ANTHROPIC_API_KEY="your-key"
OPENAI_API_KEY="your-key"

# 沙箱模式
SANDBOX_MODE="local"             # 开发用
# SANDBOX_MODE="e2b"             # 生产用

# E2B (生产环境)
E2B_API_KEY="your-key"

# Web 搜索
TAVILY_API_KEY="your-key"
```

### 前端 (frontend/.env)

```bash
NEXT_PUBLIC_API_URL=http://localhost:2024
NEXT_PUBLIC_ASSISTANT_ID=data_analyst
```

## 示例查询

### 基础统计
```
计算 [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] 的均值、中位数和标准差
```

### OLS 回归
```
生成模拟数据并运行 OLS 回归，输出 LaTeX 格式的结果表格
```

### 面板数据分析
```
创建面板数据集，运行固定效应和随机效应模型，进行 Hausman 检验
```

### DID 分析
```
设计一个 DID 分析，估计处理效应并报告结果
```

## 开发指南

详细的开发文档请参考：
- [后端文档](./backend/README.md)
- [前端文档](./frontend/README.md)

## 许可证

MIT License
