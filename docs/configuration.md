# Neloo Configuration Guide

This guide explains how to configure Neloo after cloning the repository. It covers local development, production deployment, Supabase, Railway, E2B, chat model providers, image generation, and optional integrations.

Neloo has two separate environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Never commit real `.env` files or provider keys.

## Quick Configuration Paths

### Local Minimal Setup

Use this when you only want to run the app locally with chat and local code execution.
The default `backend/langgraph.json` does not require `DATABASE_URL`; local thread history may be ephemeral.

`backend/.env`:

```env
PORT=2024
API_BASE_URL=http://localhost:2024
FRONTEND_URL=http://localhost:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
LANGGRAPH_DEFAULT_GRAPH_ID=data_analyst
SANDBOX_MODE=local
DEEPSEEK_API_KEY=your-deepseek-key
```

`frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:2024
NEXT_PUBLIC_ASSISTANT_ID=data_analyst
```

### Production Setup

Use this when deploying the backend to Railway and the frontend to Vercel. Production persistence uses `backend/langgraph.production.json` and requires `DATABASE_URL`.

Railway backend variables:

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

Vercel frontend variables:

```env
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
NEXT_PUBLIC_ASSISTANT_ID=data_analyst
```

## Configuration Locations

| File or platform | Used by | Put these values here |
| --- | --- | --- |
| `backend/.env` | Local backend | Server URLs, model keys, model base URLs, optional Supabase service key, optional database URL, storage secrets, Tavily, Composio, LangSmith |
| `frontend/.env.local` | Local frontend | Public backend URL, public Supabase anon key, Google browser keys, client-side image/slides keys |
| Railway service variables | Production backend | Same values as `backend/.env` |
| Vercel project variables | Production frontend and Next.js API routes | Same values as `frontend/.env.local`, plus server-side Next.js variables such as `NANOBANANA_IMAGE_API_KEY` |

## Backend Service Variables

Configure these in `backend/.env` for local development or in Railway for production.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | Local optional | Backend port. Local LangGraph usually uses `2024`; Railway sets this automatically. |
| `API_BASE_URL` | Recommended | Public backend URL used for callbacks and generated links. |
| `FRONTEND_URL` | Recommended | Public frontend URL. |
| `CORS_ALLOWED_ORIGINS` | Recommended | Comma-separated frontend origins allowed to call the backend. |
| `LANGGRAPH_API_URL` | Optional | LangGraph API URL. Usually the same as the backend URL. |
| `LANGGRAPH_INTERNAL_URL` | Optional | Internal LangGraph URL for server-to-server calls. |
| `LANGGRAPH_DEFAULT_GRAPH_ID` | Recommended | Default assistant graph. Keep `data_analyst` unless you change graph IDs. |
| `NELOO_BUILD_ALL_MODEL_GRAPHS` | Optional | When `false`, Neloo still registers public model graph exports and builds configured public provider graphs as needed during startup. Set `true` only to eagerly build every configured canonical and hidden legacy model graph. |
| `NELOO_BUILD_VARIANT_GRAPHS` | Optional | Set `true` to build real `-web-dev` and `-fortune` graph variants. When `false`, variant graph IDs fall back to the base graph. |
| `ENABLE_HITL` | Optional | Enables human-in-the-loop behavior when supported. |

## Frontend Service Variables

Configure these in `frontend/.env.local` for local development or in Vercel for production.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL used by the browser. |
| `NEXT_PUBLIC_ASSISTANT_ID` | Recommended | LangGraph assistant ID. Default is `data_analyst`. |
| `NEXT_PUBLIC_LANGSMITH_API_KEY` | Optional | Public LangSmith key for deployed LangGraph clients. |
| `NEXT_PUBLIC_BACKEND_URL` | Optional | Historical resume-module backend URL. Set it to the same value as `NEXT_PUBLIC_API_URL` if resume routes need it. |

## Chat Model Configuration

The model selector in the top-left of the app is controlled by the backend model registry in `backend/src/agent/graph.py`. The frontend displays one canonical entry per provider. Choose the exact model by setting the provider's `*_MODEL` variable.

Put chat model keys and base URLs in `backend/.env` locally or Railway environment variables in production. Do not put chat model provider secrets in frontend `NEXT_PUBLIC_*` variables.

A complete backend chat model provider configuration means the backend can build that provider: the API key must be present, and providers with `requires_base_url` or `requires_model_env` in `backend/src/agent/graph.py` also need the matching required base URL or model variable. Values shown in `.env.example` are examples; in Railway or another host you must set the same variables explicitly.

| UI model | Key variable | Base URL variable | Model variable | Notes |
| --- | --- | --- | --- | --- |
| DeepSeek | `DEEPSEEK_API_KEY` | None | `DEEPSEEK_MODEL` | Default: `deepseek-chat`. Use `deepseek-reasoner` if you prefer the reasoning model. |
| Qwen | `QWEN_API_KEY` | `QWEN_BASE_URL` | `QWEN_MODEL` | `QWEN_BASE_URL` must be set, commonly `https://dashscope.aliyuncs.com/compatible-mode/v1`; default model: `qwen-plus`. |
| MiniMax | `MINIMAX_API_KEY` | `MINIMAX_ANTHROPIC_BASE_URL` | `MINIMAX_MODEL` | Requires `MINIMAX_ANTHROPIC_BASE_URL` for an Anthropic-compatible MiniMax endpoint. |
| Claude | `ANTHROPIC_API_KEY` | `ANTHROPIC_BASE_URL` | `ANTHROPIC_MODEL` | Native Anthropic. Legacy `NEWAPI_API_KEY` + `NEWAPI_ANTHROPIC_BASE_URL` and `TUZI_ANTHROPIC_API_KEY` + `TUZI_ANTHROPIC_BASE_URL` are still accepted. |
| OpenAI | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `OPENAI_MODEL` | `OPENAI_BASE_URL` is optional for native OpenAI. Legacy `TUZI_API_KEY` + `TUZI_BASE_URL` is still accepted. |
| Gemini | `GEMINI_API_KEY` | `GEMINI_BASE_URL` | `GEMINI_MODEL` | `GEMINI_BASE_URL` is required unless routing through legacy `TUZI_API_KEY` + `TUZI_BASE_URL`. |
| GLM | `ZHIPU_API_KEY` | `ZHIPU_BASE_URL` | `ZHIPU_MODEL` | Requires `ZHIPU_BASE_URL` for a Zhipu OpenAI-compatible endpoint. |
| OpenRouter | `OPENROUTER_API_KEY` | `OPENROUTER_BASE_URL` | `OPENROUTER_MODEL` | `OPENROUTER_BASE_URL` must be set, commonly `https://openrouter.ai/api/v1`; default model: `meta-llama/llama-4-maverick`. |
| Custom OpenAI-compatible | `CUSTOM_OPENAI_API_KEY` | `CUSTOM_OPENAI_BASE_URL` | `CUSTOM_OPENAI_MODEL` | Both base URL and model are required for self-hosted or third-party OpenAI-compatible gateways. |
| Custom Anthropic-compatible | `CUSTOM_ANTHROPIC_API_KEY` | `CUSTOM_ANTHROPIC_BASE_URL` | `CUSTOM_ANTHROPIC_MODEL` | Both base URL and model are required for self-hosted or third-party Anthropic-compatible gateways. |

Old graph IDs such as `deepseek-chat`, `qwen3-max`, `gpt-5-thinking`, and `claude-opus-right` are hidden from the selector but kept so existing LangGraph graph IDs and older stored thread values do not crash. The thread API normalizes old stored `model_id` values to the canonical public ID for display and future updates. If you need the old exact model choice, set the canonical provider's model variable, for example `DEEPSEEK_MODEL=deepseek-reasoner`, `QWEN_MODEL=qwen3-max`, or `OPENAI_MODEL=gpt-5-thinking`.

`NEWAPI_BASE_URL` remains a legacy compatibility variable for old direct graph IDs. It does not make the canonical `OpenAI` selector entry available by itself; use `OPENAI_API_KEY`, `TUZI_API_KEY` + `TUZI_BASE_URL`, or `CUSTOM_OPENAI_*` for the public selector.

You normally do not need `NELOO_BUILD_ALL_MODEL_GRAPHS=true` for the selector. Public configured provider graph exports are registered by default. Use `NELOO_BUILD_ALL_MODEL_GRAPHS=true` only when you intentionally want all configured canonical and hidden legacy graph IDs built eagerly at import time.

## Image Generation Configuration

Neloo has multiple image-related paths. Configure only the features you use.

### Image Page and Image Editing

The image page calls Next.js API routes that use a server-side key:

| Variable | Location | Purpose |
| --- | --- | --- |
| `NANOBANANA_IMAGE_API_KEY` | `frontend/.env.local` or Vercel | Server-side key used by `frontend/src/app/api/generate-image/route.ts` and `frontend/src/app/api/edit/route.ts`. |
| `NEXT_PUBLIC_IMAGE_API_URL` | `frontend/.env.local` or Vercel | Public image API base URL used by frontend image helper clients. Defaults to `https://api.tu-zi.com`. |

### Slides / PPT Image Generation

Some slides workflows currently call providers from the browser:

| Variable | Location | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_TUZI_API_KEY` | `frontend/.env.local` or Vercel | Tu-Zi key for slides text generation and some image flows. |
| `NEXT_PUBLIC_TUZI_IMAGE_API_KEY` | `frontend/.env.local` or Vercel | Tu-Zi image key for slide image generation. Falls back to `NEXT_PUBLIC_TUZI_API_KEY` in some code paths. |
| `NEXT_PUBLIC_DEEPSEEK_API_KEY` | `frontend/.env.local` or Vercel | Used by some slidecraft flows. |
| `NEXT_PUBLIC_QWEN_API_KEY` | `frontend/.env.local` or Vercel | Used by some resume parsing flows. |

Every `NEXT_PUBLIC_*` value is exposed in the browser bundle. For production, do not place unrestricted provider keys in `NEXT_PUBLIC_*`; use restricted keys or move the provider call behind a server route.

## Supabase Configuration

Supabase is optional, but it is recommended for persistent storage, file storage, and database-backed workflows.

Backend variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_DB_HOST=db.your-project-ref.supabase.co
SUPABASE_DB_PASSWORD=your-database-password
```

Frontend variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Security rules:

- `SUPABASE_SERVICE_KEY` is a backend-only secret.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public. Configure Row Level Security in Supabase.
- Run migrations from `backend/supabase/migrations/` and `supabase/migrations/` when enabling database features.

## Database Persistence

The default local `backend/langgraph.json` does not require Postgres. Without a database, local checkpoints and history may be ephemeral.

Production persistence uses `backend/langgraph.production.json` and requires Postgres.

Preferred production variable:

```env
DATABASE_URL=postgresql://...
```

Fallback Supabase Postgres variables:

```env
SUPABASE_DB_HOST=db.your-project-ref.supabase.co
SUPABASE_DB_PASSWORD=your-database-password
```

Railway Postgres usually injects `DATABASE_URL` automatically.

## E2B Sandbox Configuration

Configure E2B in `backend/.env` locally or Railway in production:

```env
SANDBOX_MODE=e2b
E2B_API_KEY=your-e2b-api-key
```

Common modes:

| Mode | Use case |
| --- | --- |
| `local` | Local trusted development only. Code executes on your machine. |
| `docker` | Local container isolation when Docker is available. |
| `e2b` | Recommended cloud sandbox mode for production. |
| `e2b-sync` | Alias-style sync E2B mode. |
| `e2b-async` | Experimental async E2B mode. |

## File and Image Storage

Configure these in `backend/.env` or Railway:

```env
FILE_SECRET_KEY=replace-with-a-random-secret
IMAGE_SECRET_KEY=replace-with-a-random-secret
FILE_USE_LOCAL_STORAGE=true
IMAGE_USE_LOCAL_STORAGE=true
```

For production with Supabase Storage:

```env
FILE_USE_LOCAL_STORAGE=false
IMAGE_USE_LOCAL_STORAGE=false
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

Do not leave `FILE_SECRET_KEY` or `IMAGE_SECRET_KEY` as the example `change-me` values in production.

## Search, Tools, and Observability

Configure these in `backend/.env` or Railway:

| Variable | Purpose |
| --- | --- |
| `TAVILY_API_KEY` | Web search. |
| `COMPOSIO_API_KEY` | Optional third-party app integrations. |
| `LANGSMITH_API_KEY` | LangSmith tracing. |
| `LANGSMITH_TRACING_V2` | Enable or disable LangSmith tracing. |
| `LANGSMITH_PROJECT` | LangSmith project name. |

## Google Drive Picker

Configure these in `frontend/.env.local` or Vercel:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_GOOGLE_API_KEY=your-google-api-key
```

Restrict the Google API key by HTTP referrer and configure OAuth authorized origins for your local and production frontend URLs.

## AI-Assisted Configuration

This repository includes `neloo-configurator/`, a setup assistant for external AI coding tools. It is not loaded by the Neloo runtime agent.

Supported discovery wrappers:

- `.agents/skills/neloo-configurator/` for Codex, Copilot, Cursor, Gemini CLI, and other tools that scan `.agents/skills`.
- `.claude/skills/neloo-configurator/` for Claude Code.

Manual script entry points:

```bash
node neloo-configurator/scripts/setup-env.mjs
node neloo-configurator/scripts/check-env.mjs
```

## Security Checklist

- Do not commit `.env`, `.env.local`, `.env.production`, `.mcp.json`, `.vercel/`, or local databases.
- Treat every `NEXT_PUBLIC_*` variable as public.
- Keep model provider keys, Supabase service keys, E2B keys, and database passwords on the server side.
- Rotate any credential that has ever been committed.
- Run a secret scanner before publishing:

```bash
gitleaks detect --source . --verbose
```
