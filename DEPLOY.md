# Neloo Deployment Guide

This guide describes a standard production deployment with Railway for the backend, Vercel for the frontend, Supabase or Railway Postgres for persistence, and E2B for cloud sandbox execution.

For the complete environment variable matrix, see `docs/configuration.md`.

## Target Architecture

```text
User browser
  |
  v
Vercel frontend (Next.js)
  |
  v
Railway backend (LangGraph + FastAPI)
  |--------> LLM providers
  |--------> E2B sandbox
  |--------> Postgres checkpoints/store
  |--------> Supabase storage/database, if enabled
```

## Required Accounts

| Service | Purpose |
| --- | --- |
| GitHub | Source repository connected to Railway and Vercel. |
| Railway | Backend hosting and optional Postgres database. |
| Vercel | Frontend hosting. |
| E2B | Cloud sandbox for production code execution. |
| Supabase | Optional storage, browser client, migrations, and Postgres. |
| Model provider | At least one configured chat model provider. |

## Backend On Railway

### 1. Create The Service

1. Push the repository to GitHub.
2. In Railway, create a new project from the GitHub repository.
3. Use the repository root as the deployment root if you want Railway to use the root `Dockerfile`.
4. If you choose `backend/` as the Railway root directory, Railway uses `backend/Dockerfile` and `backend/railway.toml` instead.

Railway injects `PORT` automatically; you usually do not need to set it manually. The root `Dockerfile` starts LangGraph with `backend/langgraph.production.json`, which requires `DATABASE_URL` for durable checkpoints and store. The `backend/` root deployment path starts `backend/start.py`; it can boot without `DATABASE_URL`, but thread history will not persist across restarts until you configure Postgres.

### 2. Add Postgres

Use either Railway Postgres or Supabase Postgres. Railway Postgres usually injects `DATABASE_URL` automatically. If you use Supabase, set `DATABASE_URL` manually from the Supabase connection string.

### 3. Configure Backend Variables

Minimum production backend variables:

```env
API_BASE_URL=https://your-backend.up.railway.app
FRONTEND_URL=https://your-frontend.vercel.app
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
DATABASE_URL=postgresql://...
SANDBOX_MODE=e2b
E2B_API_KEY=your-e2b-api-key
FILE_SECRET_KEY=replace-with-a-random-secret
IMAGE_SECRET_KEY=replace-with-a-random-secret
DEEPSEEK_API_KEY=your-model-key
```

Add the provider-specific base URL and model variables needed by your selected model. For example, Qwen requires `QWEN_API_KEY` and `QWEN_BASE_URL`.

Optional backend variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
TAVILY_API_KEY=your-tavily-key
COMPOSIO_API_KEY=your-composio-key
LANGSMITH_API_KEY=your-langsmith-key
LANGSMITH_TRACING_V2=true
LANGSMITH_PROJECT=neloo-production
```

### 4. Verify Backend

After deployment, verify:

```bash
curl https://your-backend.up.railway.app/health
```

The backend should return a healthy response. If startup fails, check `DATABASE_URL`, model provider variables, `E2B_API_KEY`, and Railway build logs first.

### 5. Verify Docker Locally

The repository includes `.dockerignore` files so local `.env`, `.env.local`, `.vercel`, `.next`, and dependency artifacts are not copied into Docker build contexts. Keep secrets in environment variables, not in committed files or images.

Build both documented Railway backend paths before changing deployment files:

```bash
docker build -f Dockerfile -t neloo-backend-root .
docker build -f backend/Dockerfile -t neloo-backend-service backend
```

You can smoke-test the `backend/` service image without Postgres:

```bash
docker run --rm -e PORT=8000 -p 8000:8000 neloo-backend-service
curl http://localhost:8000/health
```

Runtime smoke testing for the root image needs a valid `DATABASE_URL` because it uses `backend/langgraph.production.json`.

## Frontend On Vercel

### 1. Import The Project

1. In Vercel, import the same GitHub repository.
2. Set the root directory to `frontend`.
3. Use Yarn 1.x. The canonical lockfile is `frontend/yarn.lock`.

### 2. Configure Frontend Variables

Minimum frontend variables:

```env
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
NEXT_PUBLIC_ASSISTANT_ID=data_analyst
```

`data_analyst` is the historical graph ID used by the backend for compatibility. It is not the product name.

Optional frontend variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_GOOGLE_API_KEY=your-google-browser-key
NEXT_PUBLIC_IMAGE_API_URL=https://api.tu-zi.com
NANOBANANA_IMAGE_API_KEY=your-server-side-image-key
```

Do not place unrestricted provider keys in `NEXT_PUBLIC_*` variables for production. Values with the `NEXT_PUBLIC_` prefix are bundled into browser JavaScript.

### 3. Verify Frontend

Open the Vercel URL and check:

- The app loads without a login requirement.
- The model selector can reach the backend.
- At least one configured model appears as available.
- Sending a message streams a response.
- File/image features work only after their corresponding variables are configured.

## Supabase Setup

Supabase is optional but recommended if you need storage, database-backed workflows, or browser Supabase features.

1. Create a Supabase project.
2. Configure backend service variables such as `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`.
3. Configure frontend public variables such as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` if browser features use Supabase.
4. Run relevant migrations from `backend/supabase/migrations/` and `supabase/migrations/`.
5. Enable Row Level Security policies before exposing browser Supabase features publicly.

## E2B Setup

For production, set:

```env
SANDBOX_MODE=e2b
E2B_API_KEY=your-e2b-api-key
```

Local `SANDBOX_MODE=local` executes code on the developer machine and should not be used for untrusted users.

## Deployment Checklist

- Backend service has `DATABASE_URL`.
- Backend service has at least one complete model provider configuration.
- Backend service has `SANDBOX_MODE=e2b` and `E2B_API_KEY` for production.
- `CORS_ALLOWED_ORIGINS` includes the Vercel frontend URL.
- Frontend has `NEXT_PUBLIC_API_URL` pointing at Railway.
- Frontend uses Yarn 1.x and `frontend/yarn.lock`.
- No real `.env` files or secrets are committed.
- Browser-exposed `NEXT_PUBLIC_*` keys are public, restricted, or proxied through server routes.
