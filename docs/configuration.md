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
ALLOW_ANONYMOUS=true
ALLOW_INSECURE_LOCAL_TOKENS=true
ANONYMOUS_SESSION_SECRET=replace-with-a-random-32-byte-secret
```

`frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:2024
NEXT_PUBLIC_ASSISTANT_ID=data_analyst
ANONYMOUS_SESSION_SECRET=replace-with-the-same-random-secret
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
DEEPSEEK_API_KEY=your-model-key
ALLOW_ANONYMOUS=true
ALLOW_INSECURE_LOCAL_TOKENS=false
ANONYMOUS_SESSION_SECRET=replace-with-a-random-32-byte-secret
```

Vercel frontend variables:

```env
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
NEXT_PUBLIC_ASSISTANT_ID=data_analyst
ANONYMOUS_SESSION_SECRET=replace-with-the-same-random-secret
```

## Configuration Locations

| File or platform | Used by | Put these values here |
| --- | --- | --- |
| `backend/.env` | Local backend | Server URLs, model keys, model base URLs, optional Supabase service key, optional database URL, storage secrets, Tavily, Composio, LangSmith |
| `frontend/.env.local` | Local frontend | Public backend URL, public Supabase anon key, Google browser keys, client-side image/slides keys |
| Railway service variables | Production backend | Same values as `backend/.env` |
| Vercel project variables | Production frontend and Next.js API routes | Same values as `frontend/.env.local`, plus server-side Next.js variables such as `GEMINI_IMAGE_API_KEY` |

## Backend Service Variables

Configure these in `backend/.env` for local development or in Railway for production.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | Local optional | Backend port. Local LangGraph usually uses `2024`; Railway sets this automatically. |
| `API_BASE_URL` | Recommended | Public backend URL used for callbacks and generated links. |
| `FRONTEND_URL` | Recommended | Public frontend URL. |
| `CORS_ALLOWED_ORIGINS` | Recommended | Comma-separated frontend origins allowed to call the backend. Defaults to `http://localhost:3000,http://localhost:3001`. |
| `LANGGRAPH_API_URL` | Optional | LangGraph API URL. Usually the same as the backend URL. |
| `LANGGRAPH_INTERNAL_URL` | Optional | Internal LangGraph URL for server-to-server calls. |
| `LANGGRAPH_DEFAULT_GRAPH_ID` | Recommended | Default assistant graph. Keep `data_analyst` unless you change graph IDs. |
| `NELOO_BUILD_ALL_MODEL_GRAPHS` | Optional | When `false`, Neloo still registers public model graph exports and builds configured public provider graphs as needed during startup. Set `true` only to eagerly build every configured canonical and hidden legacy model graph. |
| `NELOO_BUILD_VARIANT_GRAPHS` | Optional | Set `true` to build real `-web-dev` and `-fortune` graph variants. When `false`, variant graph IDs fall back to the base graph. |
| `ENABLE_HITL` | Optional | Enables human-in-the-loop behavior when supported. |
| `MINIMAX_BASE_URL` | Legacy optional | Legacy MiniMax-compatible base URL. New deployments should use `MINIMAX_ANTHROPIC_BASE_URL`. |

## Frontend Service Variables

Configure these in `frontend/.env.local` for local development or in Vercel for production.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL used by the browser and by the resume module's server-side proxy calls. |
| `NEXT_PUBLIC_ASSISTANT_ID` | Recommended | LangGraph assistant ID. Default is `data_analyst`. |
| `NEXT_PUBLIC_LANGSMITH_API_KEY` | Optional | Public LangSmith key for deployed LangGraph clients. |
| `NEXT_PUBLIC_BACKEND_URL` | Deprecated | Old resume-module backend URL. No longer read; set `NEXT_PUBLIC_API_URL` instead. |
| `ANONYMOUS_SESSION_SECRET` | Required for production guest mode | Server-only value shared with backend. It signs isolated browser guest sessions; never use a `NEXT_PUBLIC_` prefix. |

## Guest Sessions

Neloo has no login flow. Instead, the frontend asks its own Next.js server for a signed guest session and sends that token to the backend. Set the same strong `ANONYMOUS_SESSION_SECRET` in the backend and frontend server environments. Each browser keeps its own guest identity and local files, history, and slides are isolated by that identity.

`ALLOW_INSECURE_LOCAL_TOKENS=true` is only for localhost development when a shared secret is unavailable. Keep it `false` for a public deployment. Guest sessions are not account authentication: use explicit CORS origins, E2B rather than local code execution, and platform-level rate limits for any public instance.

## Chat Model Configuration

The model selector in the top-left of the app is controlled by the backend model registry in `backend/src/agent/graph.py`. The frontend displays one canonical entry per provider route, labeled with the concrete default model rather than only the company or gateway name. Choose a different concrete model by setting the provider's `*_MODEL` variable.

Put chat model keys and base URLs in `backend/.env` locally or Railway environment variables in production. Do not put chat model provider secrets in frontend `NEXT_PUBLIC_*` variables.

A complete backend chat model provider configuration means the backend can build that provider: the API key must be present, and providers with `requires_base_url` or `requires_model_env` in `backend/src/agent/graph.py` also need the matching required base URL or model variable. Empty values and obvious placeholders such as `your-key`, `replace-me`, or `placeholder` are treated as unconfigured. Values shown in `.env.example` are examples; in Railway or another host you must set the same variables explicitly.

| UI model | Key variable | Base URL variable | Model variable | Notes |
| --- | --- | --- | --- | --- |
| DeepSeek V4 Pro | `DEEPSEEK_API_KEY` | None | `DEEPSEEK_MODEL` | Default: `deepseek-v4-pro`. |
| Qwen3.7 Max | `QWEN_API_KEY` | `QWEN_BASE_URL` | `QWEN_MODEL` | `QWEN_BASE_URL` must be set, commonly `https://dashscope.aliyuncs.com/compatible-mode/v1`; default model: `qwen3.7-max`. |
| MiniMax M2.7 | `MINIMAX_API_KEY` | `MINIMAX_ANTHROPIC_BASE_URL` | `MINIMAX_MODEL` | Requires an Anthropic-compatible endpoint, commonly `https://api.minimax.io/anthropic`; default model: `MiniMax-M2.7`. |
| Claude Opus 4.8 | `ANTHROPIC_API_KEY` | `ANTHROPIC_BASE_URL` | `ANTHROPIC_MODEL` | Native Anthropic. `NEWAPI_API_KEY` + `NEWAPI_ANTHROPIC_BASE_URL` remains available for custom deployments. |
| GPT-5.5 | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `OPENAI_MODEL` | `OPENAI_BASE_URL` is optional for native OpenAI. |
| Gemini 3.1 Pro Preview | `GEMINI_API_KEY` | `GEMINI_BASE_URL` | `GEMINI_MODEL` | Uses Google's OpenAI-compatible endpoint by default: `https://generativelanguage.googleapis.com/v1beta/openai/`; default model: `gemini-3.1-pro-preview`. |
| GLM-5.2 | `ZHIPU_API_KEY` | `ZHIPU_BASE_URL` | `ZHIPU_MODEL` | Uses Z.AI's OpenAI-compatible endpoint, commonly `https://api.z.ai/api/paas/v4`; default model: `GLM-5.2`. |
| OpenRouter | `OPENROUTER_API_KEY` | `OPENROUTER_BASE_URL` | `OPENROUTER_MODEL` | A multi-provider route. `OPENROUTER_BASE_URL` must be set, commonly `https://openrouter.ai/api/v1`; default is `meta-llama/llama-4-maverick`, but you can set any available OpenRouter model such as `z-ai/glm-5.2`. |
| Custom OpenAI-compatible | `CUSTOM_OPENAI_API_KEY` | `CUSTOM_OPENAI_BASE_URL` | `CUSTOM_OPENAI_MODEL` | Both base URL and model are required for self-hosted or third-party OpenAI-compatible gateways. |
| Custom Anthropic-compatible | `CUSTOM_ANTHROPIC_API_KEY` | `CUSTOM_ANTHROPIC_BASE_URL` | `CUSTOM_ANTHROPIC_MODEL` | Both base URL and model are required for self-hosted or third-party Anthropic-compatible gateways. |

**Gemini routing:** Neloo uses Google's OpenAI-compatible endpoint (`GEMINI_BASE_URL` + `GEMINI_API_KEY`) by default. You can override the base URL for a compatible gateway when needed.

Old graph IDs such as `deepseek-chat`, `qwen3-max`, `gpt-5-thinking`, and `claude-opus-right` are hidden from the selector but kept so existing LangGraph graph IDs and older stored thread values do not crash. Neloo normalizes them to the canonical provider and uses that provider's current `*_MODEL` value. To choose an exact model, set the canonical provider's model variable, for example `DEEPSEEK_MODEL=deepseek-v4-flash`, `QWEN_MODEL=qwen3.7-max`, or `OPENROUTER_MODEL=z-ai/glm-5.2`.

`NEWAPI_BASE_URL` remains a legacy compatibility variable for old direct graph IDs. It does not make the canonical `OpenAI` selector entry available by itself; use `OPENAI_API_KEY` or `CUSTOM_OPENAI_*` for the public selector.

You normally do not need `NELOO_BUILD_ALL_MODEL_GRAPHS=true` for the selector. Public configured provider graph exports are registered by default. Use `NELOO_BUILD_ALL_MODEL_GRAPHS=true` only when you intentionally want all configured canonical and hidden legacy graph IDs built eagerly at import time.

## Image Generation Configuration

Neloo has multiple image-related paths. Configure only the features you use.

### Image Page and Image Editing

The image page calls Next.js API routes that use a server-side key:

| Variable | Location | Purpose |
| --- | --- | --- |
| `GEMINI_IMAGE_API_KEY` | `frontend/.env.local` or Vercel | Server-side Google AI Studio key for Nano Banana 2. `GEMINI_API_KEY` can be reused when appropriate. |
| `GEMINI_IMAGE_MODEL` | `frontend/.env.local` or Vercel | Optional Nano Banana 2 override. Defaults to `gemini-3.1-flash-image`. |
| `OPENAI_API_KEY` | `frontend/.env.local` or Vercel | Server-side OpenAI key for GPT Image 2. |
| `OPENAI_IMAGE_MODEL` | `frontend/.env.local` or Vercel | Optional OpenAI image model override. Defaults to `gpt-image-2`. |

### Slides / PPT Image Generation

Slides text generation uses the backend-selected chat model through `/api/slides/generate`. Slide images use the same server-side Next.js image route as the image page. Do not put unrestricted provider API keys in `NEXT_PUBLIC_*` variables.

## Supabase Configuration

Supabase is optional for a minimal local chat run, but it is required for durable chat history, share links, fork/regenerate history, DB spot checks, persistent storage, file storage, and database-backed workflows. If `SUPABASE_URL` points to a deleted, mistyped, or unreachable project, the backend cannot create durable thread records.

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

### Legacy LangGraph thread ownership

Existing deployments created before runtime authentication may have LangGraph threads
without `metadata.owner`. Do not deploy the new custom Auth configuration before those
threads are migrated. Use this maintenance sequence against the old backend:

```bash
cd backend
LANGGRAPH_INTERNAL_URL=http://127.0.0.1:2024 \
  .venv/bin/python scripts/backfill_langgraph_thread_owners.py --dry-run
LANGGRAPH_INTERNAL_URL=http://127.0.0.1:2024 \
  .venv/bin/python scripts/backfill_langgraph_thread_owners.py
LANGGRAPH_INTERNAL_URL=http://127.0.0.1:2024 \
  .venv/bin/python scripts/backfill_langgraph_thread_owners.py --check
```

The script reads the canonical owner mapping from the Supabase `threads` table. It is
idempotent and stops on conflicting owners. Targets must be loopback or RFC1918 URLs;
remote targets require the explicit `ALLOW_REMOTE_OWNER_BACKFILL=true` override. If the
old endpoint requires a bearer token, set `OWNER_BACKFILL_AUTH_TOKEN` in the shell. The
script never prints that token or thread content.

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
| `e2b` | Recommended cloud sandbox mode for production. |
| `e2b-sync` | Alias-style sync E2B mode. |
| `e2b-async` | Experimental async E2B mode. |
| `docker` | Planned — not implemented in this release. |

`SANDBOX_MODE=local` runs untrusted user code directly on the host with no isolation. Starting a local execution requires the explicit `ALLOW_LOCAL_SANDBOX=true` opt-in in `backend/.env`; guest mode never enables host code execution. Use `e2b` for any shared or public deployment.

## Hidden System Prompt

The agent assembles a hidden system prompt (tool inventory, context, policy) that is prepended to conversations but is intentionally kept out of the visible chat surface. **Known limitation:** during streaming, the assembled prompt envelope is currently visible in the raw stream until the first user-facing token arrives. Sanitization at rest and in stored thread state is covered by tests; full stream-time hiding is tracked as follow-up work. Do not put secrets in the hidden prompt.

## File and Image Storage

Configure these in `backend/.env` or Railway:

```env
FILE_SECRET_KEY=replace-with-a-random-secret
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

Do not leave `FILE_SECRET_KEY` as the example `change-me` value in production.

**Signed download URLs are bearer tokens.** Generated-file and image downloads are gated by an HMAC signature over the file id derived from `FILE_SECRET_KEY`. Download URLs expire after 7 days by default. Anyone who has the full URL — including the `?sig=...` portion — can download that specific file until the URL expires or the secret rotates. The signature prevents forging URLs for *other* files. Set a stable, high-entropy `FILE_SECRET_KEY` in any multi-worker or production deployment; otherwise each worker generates its own random key and URLs fail to verify across workers. Rotate the key if a URL leaks.

## Search, Tools, and Observability

Configure these in `backend/.env` or Railway:

| Variable | Purpose |
| --- | --- |
| `TAVILY_API_KEY` | Web search. |
| `COMPOSIO_API_KEY` | Optional third-party app integrations. |
| `COMPOSIO_AUTH_CONFIGS_JSON` | Required with `COMPOSIO_API_KEY` | JSON map of app names to auth config IDs created in your own Composio workspace, for example `{"github":"ac_your_config"}`. |
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

- `ANONYMOUS_SESSION_SECRET` must be server-only and identical in the backend and frontend environments. Never expose it through a `NEXT_PUBLIC_` variable.
- **Rate limiting is not bundled.** For any public deployment, add per-user/per-IP rate limiting on the LLM-proxy routes (`/api/resume/*`, `/api/translate`, `/api/slides/*`) and the PDF/Chromium route. `slowapi` is a common choice; remember to parse `X-Forwarded-For` behind Railway/Cloudflare so limits key on the real client.
- **Hidden/system prompts are sanitized from persisted thread state, but are still visible in the live stream response.** If you depend on prompt confidentiality, treat the streaming channel as exposing the system prompt.
- Do not commit `.env`, `.env.local`, `.env.production`, `.mcp.json`, `.vercel/`, or local databases.
- Treat every `NEXT_PUBLIC_*` variable as public.
- Keep model provider keys, Supabase service keys, E2B keys, and database passwords on the server side.
- Rotate any credential that has ever been committed.
- Run a secret scanner before publishing:

```bash
gitleaks detect --source . --verbose
```
