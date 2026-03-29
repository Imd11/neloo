# ============================================================================
# Data Analyst Backend - Dockerfile (Root Level)
# ============================================================================
# 用于部署到 Railway 或其他容器平台
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
    pip install --no-cache-dir "langgraph-api>=0.0.1"

# 安装 Playwright Chromium 浏览器（用于 /api/resume/pdf 矢量 PDF 导出）
# 注意：仅安装 Python 包不包含浏览器二进制，必须额外执行 install。
RUN python -m playwright install chromium --with-deps

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

# 启动命令 - 使用生产入口，显式启用 PostgreSQL checkpointer
CMD ["python", "start.py"]
