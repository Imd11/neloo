# ============================================================================
# Neloo Backend - Dockerfile (Root Level)
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

# 复制后端代码和配置，确保 pip install . 能看到 src 包。
COPY backend/ .

# 安装 Python 依赖
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir . && \
    pip install --no-cache-dir "langgraph-cli[inmem]" && \
    pip install --no-cache-dir "langgraph-api>=0.0.1"

# 安装 Playwright Chromium 浏览器（用于 /api/resume/pdf 矢量 PDF 导出）
# 注意：仅安装 Python 包不包含浏览器二进制，必须额外执行 install。
RUN python -m playwright install chromium --with-deps

# 创建数据目录
RUN mkdir -p /app/data

# 设置环境变量
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PORT=8000

# 暴露端口
EXPOSE 8000

# 启动命令 - 使用当前环境兼容的 LangGraph CLI 入口，并关闭热重载
CMD ["python", "-m", "langgraph_cli", "dev", "--config", "langgraph.production.json", "--no-reload", "--port", "8000", "--host", "0.0.0.0", "--allow-blocking"]
