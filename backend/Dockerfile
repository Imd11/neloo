# ============================================================================
# Neloo Backend - Dockerfile
# ============================================================================
# 用于部署到 Railway 或其他容器平台
# ============================================================================

FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖 (including Playwright/Chromium dependencies)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    # Playwright Chromium dependencies
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    # Chinese font support
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# 复制后端代码和配置，确保 pip install . 能看到 src 包。
COPY . .

# 安装 Python 依赖 (包括 playwright)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# 安装 Playwright Chromium 浏览器
# 注意: 必须在 pip install 之后执行，确保 playwright 包已安装
RUN python -m playwright install chromium --with-deps

# 创建数据目录
RUN mkdir -p /app/data

# 设置环境变量
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PORT=8000

# 暴露端口
EXPOSE 8000

# 启动命令 - 使用 langgraph 生产服务器
CMD ["python", "start.py"]
