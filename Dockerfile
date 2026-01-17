# ============================================================================
# Data Analyst Backend - Dockerfile (Root Level)
# ============================================================================
# 用于部署到 Railway 或其他容器平台
# 使用 start.py 启动，配置 PostgreSQL checkpointer 用于对话历史持久化
# ============================================================================

FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件和 README
COPY backend/pyproject.toml ./
COPY backend/README.md ./

# 安装 Python 依赖
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir . && \
    pip install --no-cache-dir "langgraph-cli[inmem]" && \
    pip install --no-cache-dir "langgraph-api>=0.0.1" && \
    pip install --no-cache-dir "langgraph-checkpoint-postgres>=2.0.0"

# 复制应用代码
COPY backend/ .

# 创建数据目录
RUN mkdir -p /app/data

# 设置环境变量
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PORT=8000

# 暴露端口
EXPOSE 8000

# 启动命令 - 使用 start.py 启动服务
# start.py 使用 langgraph.server (开源) 创建完整 LangGraph Server
# 并配置 PostgresSaver 连接 Supabase 数据库实现对话历史持久化
CMD ["python", "start.py"]

