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
    pip install --no-cache-dir .

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

# 启动命令 - 直接运行 FastAPI 应用
# 使用 uvicorn 运行 FastAPI app (来自 langgraph.json 的 http.app 配置)
CMD ["python", "-m", "uvicorn", "src.api.webapp:app", "--host", "0.0.0.0", "--port", "8000"]
