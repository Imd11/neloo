# 部署指南

本文档介绍如何将 Data Analyst Agent 部署到云端。

## 架构概览

```
┌─────────────────────────────────────────────────┐
│                    你的域名                      │
├─────────────────────────────────────────────────┤
│  yourdomain.com     │  api.yourdomain.com       │
│      (Vercel)       │      (Railway)            │
│      前端 Next.js    │      后端 LangGraph       │
├─────────────────────────────────────────────────┤
│                   外部服务                       │
│  Supabase (存储)  │  E2B (沙箱)  │  DeepSeek   │
└─────────────────────────────────────────────────┘
```

---

## 准备工作

### 1. 获取必要的 API Keys

| 服务 | 用途 | 获取地址 |
|------|------|---------|
| E2B | 代码执行沙箱 | https://e2b.dev |
| DeepSeek | AI 模型 | https://platform.deepseek.com |
| Supabase | 文件存储 | https://supabase.com |
| Tavily | 网页搜索 | https://tavily.com |

### 2. 将代码推送到 GitHub

```bash
# 在项目根目录
cd /path/to/data-analyst

# 初始化 Git (如果还没有)
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit for deployment"

# 创建 GitHub 仓库并推送
# 方法1: 使用 GitHub CLI
gh repo create data-analyst --private --source=. --push

# 方法2: 手动创建仓库后
git remote add origin https://github.com/YOUR_USERNAME/data-analyst.git
git push -u origin main
```

---

## 第一步：部署后端到 Railway

### 1.1 创建 Railway 账号

1. 访问 https://railway.app
2. 使用 GitHub 账号登录

### 1.2 创建新项目

1. 点击 "New Project"
2. 选择 "Deploy from GitHub repo"
3. 选择你的 `data-analyst` 仓库
4. **重要**: 设置 Root Directory 为 `backend`

### 1.3 配置环境变量

在 Railway 项目设置中添加以下环境变量:

```env
# 模型 API
ANTHROPIC_API_KEY=sk-xxx
ANTHROPIC_BASE_URL=https://api.tu-zi.com
DEEPSEEK_API_KEY=sk-xxx

# 沙箱执行 (必须使用 e2b)
SANDBOX_MODE=e2b
E2B_API_KEY=e2b_xxx

# 网页搜索
TAVILY_API_KEY=tvly-xxx

# 文件存储
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx

# 其他
API_BASE_URL=https://你的railway域名.up.railway.app
IMAGE_SECRET_KEY=your-secret-key-here
```

### 1.4 部署

Railway 会自动检测 Dockerfile 并开始构建。等待部署完成后，你会获得一个 URL，例如:
```
https://data-analyst-backend-production.up.railway.app
```

### 1.5 配置自定义域名 (可选)

1. 在 Railway 项目设置中找到 "Domains"
2. 点击 "Add Custom Domain"
3. 输入 `api.yourdomain.com`
4. 按照提示在你的 DNS 添加 CNAME 记录

---

## 第二步：部署前端到 Vercel

### 2.1 创建 Vercel 账号

1. 访问 https://vercel.com
2. 使用 GitHub 账号登录

### 2.2 导入项目

1. 点击 "Add New" → "Project"
2. 选择你的 `data-analyst` 仓库
3. **重要**: 设置 Root Directory 为 `frontend`
4. Framework Preset 会自动检测为 "Next.js"

### 2.3 配置环境变量

在 Vercel 项目设置中添加:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_ASSISTANT_ID=data_analyst
```

> 注意: `NEXT_PUBLIC_API_URL` 是后端的地址，如果还没有配置自定义域名，
> 使用 Railway 提供的默认地址，如 `https://xxx.up.railway.app`

### 2.4 部署

点击 "Deploy" 开始部署。完成后你会获得一个 URL，例如:
```
https://data-analyst-frontend.vercel.app
```

### 2.5 配置自定义域名

1. 在 Vercel 项目设置中找到 "Domains"
2. 点击 "Add"
3. 输入 `yourdomain.com`
4. 按照提示配置 DNS:

| 类型 | 名称 | 值 |
|------|------|-----|
| CNAME | @ | cname.vercel-dns.com |
| CNAME | www | cname.vercel-dns.com |

---

## 第三步：配置域名 DNS

假设你的域名是 `yourdomain.com`，在域名管理面板添加:

| 类型 | 名称 | 值 | 说明 |
|------|------|-----|------|
| CNAME | @ | cname.vercel-dns.com | 主域名指向前端 |
| CNAME | www | cname.vercel-dns.com | www 指向前端 |
| CNAME | api | xxx.up.railway.app | API 子域名指向后端 |

> 注意: Railway 的 CNAME 值需要在 Railway 控制台查看

---

## 第四步：验证部署

### 4.1 测试后端

```bash
# 测试健康检查
curl https://api.yourdomain.com/ok

# 应该返回: {"status": "ok"}
```

### 4.2 测试前端

1. 访问 https://yourdomain.com
2. 应该看到配置页面
3. 如果已设置环境变量，会自动连接到后端

### 4.3 测试完整流程

1. 在前端上传一个 CSV 文件
2. 输入一个数据分析请求
3. 确认 AI 能够执行代码并返回结果

---

## 费用估算

| 服务 | 费用 |
|------|------|
| Vercel | 免费 (Hobby 计划) |
| Railway | ~$5-10/月 |
| E2B | 按执行时间计费，~$0.01/分钟 |
| Supabase | 免费 (已有账号) |
| 域名 | 已有 |

**预估总费用: $5-15/月**

---

## 常见问题

### Q: 后端启动失败？
检查环境变量是否正确配置，特别是:
- `E2B_API_KEY` 是否有效
- `SANDBOX_MODE` 是否设置为 `e2b`

### Q: 前端无法连接后端？
1. 确认 `NEXT_PUBLIC_API_URL` 配置正确
2. 确认后端 CORS 设置允许前端域名
3. 检查浏览器控制台错误信息

### Q: 代码执行超时？
E2B 默认超时 5 分钟，对于复杂分析可能需要调整 `timeout` 参数。

---

## 更新部署

### 后端更新
推送代码到 GitHub 后，Railway 会自动重新部署。

### 前端更新
推送代码到 GitHub 后，Vercel 会自动重新部署。

---

## 回滚

### Railway
在 Railway 控制台的 "Deployments" 中选择之前的部署版本点击 "Redeploy"。

### Vercel
在 Vercel 控制台的 "Deployments" 中选择之前的部署版本点击 "Promote to Production"。
