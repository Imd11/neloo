# Neloo Configuration Map

This reference is the source of truth for the `neloo-configurator` skill and its scripts. Use it when deciding which environment variables to ask for, where to write them, and how to diagnose missing or unsafe configuration.

## Environment Files

| Path | Owner | Purpose | Commit? |
| --- | --- | --- | --- |
| `backend/.env.example` | Repository | Backend template | Yes |
| `backend/.env` | User | Local backend secrets and settings | No |
| `frontend/.env.example` | Repository | Frontend template | Yes |
| `frontend/.env.local` | User | Local frontend settings and Next.js route secrets | No |

Production equivalents:

| Platform | Configure values equivalent to |
| --- | --- |
| Railway backend service | `backend/.env` |
| Vercel frontend project | `frontend/.env.local` |

Local development uses `backend/langgraph.json`, which does not require `DATABASE_URL`. Production persistence uses `backend/langgraph.production.json` and requires `DATABASE_URL`.

The frontend uses Yarn 1.x. `frontend/yarn.lock` is the canonical dependency lockfile; do not generate or commit `frontend/package-lock.json`.

## Required Minimal Local Setup

| Variable | Location | Required when | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | Always | Browser URL for the backend, usually `http://localhost:2024`. |
| `NEXT_PUBLIC_ASSISTANT_ID` | `frontend/.env.local` | Recommended | Keep `data_analyst` unless graph IDs change. |
| `API_BASE_URL` | `backend/.env` | Recommended | Backend public URL, usually `http://localhost:2024`. |
| `FRONTEND_URL` | `backend/.env` | Recommended | Frontend URL, usually `http://localhost:3000` or `http://localhost:3001`. |
| `CORS_ALLOWED_ORIGINS` | `backend/.env` | Recommended | Include every frontend origin. |
| `SANDBOX_MODE` | `backend/.env` | Always | Use `local` for trusted local development. |
| `ALLOW_ANONYMOUS` | `backend/.env` | Always | Enables Neloo's login-free guest sessions. |
| `ANONYMOUS_SESSION_SECRET` | `backend/.env` and `frontend/.env.local` | Production guest mode | Server-only secret shared by both servers to sign isolated browser guest sessions. |
| `ALLOW_INSECURE_LOCAL_TOKENS` | `backend/.env` | Local development only | Allows raw local development tokens when no shared guest-session secret exists. Keep `false` publicly. |
| One chat model key | `backend/.env` | Always for chat | At least one key from the chat model provider table. |
| `DATABASE_URL` | `backend/.env` | Production checkpoint persistence only | Not required by the default local `backend/langgraph.json`; required by `backend/langgraph.production.json`. Durable app-level chat history, share links, fork/regenerate history, and DB spot checks are Supabase-backed and require `SUPABASE_URL` plus `SUPABASE_SERVICE_KEY`. |

## Backend Server Variables

| Variable | Location | Required when | Security | Feature |
| --- | --- | --- | --- | --- |
| `PORT` | Backend | Local optional | Public | Backend port. Railway usually injects this. |
| `API_BASE_URL` | Backend | Recommended | Public | Generated links and callbacks. |
| `FRONTEND_URL` | Backend | Recommended | Public | CORS and integration callbacks. |
| `CORS_ALLOWED_ORIGINS` | Backend | Recommended | Public | Browser access control. |
| `CORS_ORIGINS` | Backend | Legacy optional | Public | Alternate CORS variable accepted by startup code. |
| `LANGGRAPH_API_URL` | Backend | Optional | Public/internal | LangGraph API URL. |
| `LANGGRAPH_INTERNAL_URL` | Backend | Optional | Internal | Internal LangGraph calls. |
| `LANGGRAPH_DEFAULT_GRAPH_ID` | Backend | Recommended | Public | Default graph ID. Current default is `data_analyst`. |
| `NELOO_BUILD_ALL_MODEL_GRAPHS` | Backend | Optional | Public config | `false` keeps startup lighter while still exposing public selector graph IDs; `true` eagerly builds every configured canonical and hidden legacy model graph. |
| `NELOO_BUILD_VARIANT_GRAPHS` | Backend | Optional | Public config | `true` builds real `-web-dev` and `-fortune` variants; `false` aliases variant graph IDs to the base graph. |
| `ENABLE_HITL` | Backend | Required in production | Public | Keep `true`; only explicit insecure local development may disable approvals. |

## Frontend Variables

| Variable | Location | Required when | Security | Feature |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Frontend | Always | Public browser value | Connects frontend to backend. |
| `NEXT_PUBLIC_ASSISTANT_ID` | Frontend | Recommended | Public browser value | Default graph ID. |
| `NEXT_PUBLIC_LANGSMITH_API_KEY` | Frontend | Optional | Public browser value | LangSmith client integrations. |
| `NEXT_PUBLIC_BACKEND_URL` | Frontend | Resume routes using legacy helpers | Public browser value | Historical resume backend URL. Usually same as `NEXT_PUBLIC_API_URL`. |

## Chat Model Provider Variables

These are backend secrets. Configure them in `backend/.env` locally or Railway in production. The top-left model selector reads `/api/models`, and the backend marks each model available only when a complete backend chat model provider configuration is present: the provider's key, required base URL, and required model variable.

| UI model | Model ID | Key variable | Base URL variable | Model variable | Security |
| --- | --- | --- | --- | --- | --- |
| DeepSeek | `deepseek` | `DEEPSEEK_API_KEY` | None | `DEEPSEEK_MODEL` | Secret |
| Qwen | `qwen` | `QWEN_API_KEY` | `QWEN_BASE_URL` | `QWEN_MODEL` | Secret |
| MiniMax | `minimax` | `MINIMAX_API_KEY` | `MINIMAX_ANTHROPIC_BASE_URL` | `MINIMAX_MODEL` | Secret |
| Claude | `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_BASE_URL` | `ANTHROPIC_MODEL` | Secret |
| OpenAI | `openai` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `OPENAI_MODEL` | Secret |
| Gemini | `gemini` | `GEMINI_API_KEY` | `GEMINI_BASE_URL` | `GEMINI_MODEL` | Secret |
| GLM-5.2 | `zhipu` | `ZHIPU_API_KEY` | `ZHIPU_BASE_URL` | `ZHIPU_MODEL` | Secret |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` | `OPENROUTER_BASE_URL` | `OPENROUTER_MODEL` | Secret |
| Custom OpenAI-compatible | `custom-openai` | `CUSTOM_OPENAI_API_KEY` | `CUSTOM_OPENAI_BASE_URL` | `CUSTOM_OPENAI_MODEL` | Secret |
| Custom Anthropic-compatible | `custom-anthropic` | `CUSTOM_ANTHROPIC_API_KEY` | `CUSTOM_ANTHROPIC_BASE_URL` | `CUSTOM_ANTHROPIC_MODEL` | Secret |

Legacy `NEWAPI_*` and old graph IDs such as `deepseek-chat`, `qwen3-max`, and `claude-opus-right` remain supported for existing deployments, but new setup flows should guide users to the canonical entries above.

Old graph IDs are hidden from the selector but kept so existing LangGraph graph IDs and older stored thread values do not crash. Neloo normalizes them to the canonical provider and uses that provider's current `*_MODEL` value. For an exact model choice, set the canonical provider model variable, for example `DEEPSEEK_MODEL=deepseek-v4-flash`, `QWEN_MODEL=qwen3.7-max`, or `OPENROUTER_MODEL=z-ai/glm-5.2`.

`NEWAPI_BASE_URL` remains a legacy compatibility variable for old direct graph IDs. It does not count as a complete canonical public provider route by itself; use `OPENAI_API_KEY` or `CUSTOM_OPENAI_*` for the public selector.

## Image Generation Variables

| Variable | Location | Required when | Security | Feature |
| --- | --- | --- | --- | --- |
| `GEMINI_IMAGE_API_KEY` | Frontend environment / Vercel server-side | Using Nano Banana 2 through `/api/generate-image` or `/api/edit` | Secret, do not prefix with `NEXT_PUBLIC_` | Google AI Studio key for Next.js image generation and editing routes. `GEMINI_API_KEY` can be reused when appropriate. |
| `GEMINI_IMAGE_MODEL` | Frontend environment / Vercel server-side | Optional | Server configuration | Defaults to `gemini-3.1-flash-image`. |
| `OPENAI_API_KEY` | Frontend environment / Vercel server-side | Using GPT Image 2 | Secret, do not prefix with `NEXT_PUBLIC_` | Server-side image provider key. |
| `OPENAI_IMAGE_MODEL` | Frontend environment / Vercel server-side | Optional | Public config | Defaults to `gpt-image-2`. |

## Supabase Variables

| Variable | Location | Required when | Security | Feature |
| --- | --- | --- | --- | --- |
| `SUPABASE_URL` | Backend | Supabase storage, database, scripts | Public-ish backend config | Supabase project URL. |
| `SUPABASE_SERVICE_KEY` | Backend | Supabase server access | Secret | Service role key. Never expose in frontend. |
| `SUPABASE_JWT_SECRET` | Backend | JWT verification | Secret | Required only for real Supabase auth verification. |
| `SUPABASE_DB_HOST` | Backend | Supabase Postgres fallback | Secret-ish | Used to construct Postgres URL when `DATABASE_URL` is absent. |
| `SUPABASE_DB_PASSWORD` | Backend | Supabase Postgres fallback | Secret | Database password. |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | Supabase browser features | Public browser value | Supabase client URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Supabase browser features | Public browser value | Public anon key; configure RLS. |

## Shared Usage Limits

| Variable | Location | Required when | Security | Feature |
| --- | --- | --- | --- | --- |
| `RATE_LIMIT_REDIS_URL` | Backend and frontend server environments | Every production deployment | Secret, never `NEXT_PUBLIC_` | Shared guest/IP windows, daily budgets, and concurrency leases. Use the same Redis service in Railway and Vercel. |
| `RATE_LIMIT_NAMESPACE` | Backend and frontend server environments | Optional | Public config | Redis key prefix; defaults to `neloo`. Values must match. |
| `TRUSTED_PROXY_HOPS` | Backend and frontend server environments | Non-Vercel production behind a trusted proxy | Public config | Selects the trusted client address from the right side of a proxy chain that strips and replaces incoming forwarding headers. Vercel uses its overwritten platform header. |
| `GUEST_SESSIONS_PER_DAY` | Frontend server environment | Optional | Public config | Maximum new anonymous identities per trusted client address in 24 hours; defaults to `2`. |
| `MODEL_RUNS_PER_10_MINUTES` | Backend | Optional | Public config | Chat, Slides, translate, resume, and integration window. |
| `IMAGE_RUNS_PER_10_MINUTES` | Frontend server environment | Optional | Public config | Generate, edit, and resize image window. |
| `E2B_RUNS_PER_10_MINUTES` | Backend | Optional | Public config | E2B execution window. |
| `DAILY_BUDGET_UNITS` | Backend and frontend server environments | Optional | Public config | Stable daily cost-unit ceiling per guest. |

Durable app-level chat history, share links, fork/regenerate history, and DB spot checks require a reachable `SUPABASE_URL` and a valid backend-only `SUPABASE_SERVICE_KEY`. Local chat can run without these values, but those durable workflows must be reported as unavailable rather than passed during verification.

## Persistence and Storage Variables

| Variable | Location | Required when | Security | Feature |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Backend | Production persistence with `backend/langgraph.production.json` | Secret | Postgres connection string, often injected by Railway. Local-minimal diagnostics warn when absent; production diagnostics fail when absent. |
| `FILE_SECRET_KEY` | Backend | Production file links | Secret | Signs file URLs. Replace default `change-me` value. |
| `IMAGE_SECRET_KEY` | Backend | Production image links | Secret | Signs image URLs. Replace default `change-me` value. |
| `FILE_USE_LOCAL_STORAGE` | Backend | Storage selection | Public config | `true` forces local file storage. |
| `IMAGE_USE_LOCAL_STORAGE` | Backend | Storage selection | Public config | `true` forces local image storage. |

## Sandbox Variables

| Variable | Location | Required when | Security | Feature |
| --- | --- | --- | --- | --- |
| `SANDBOX_MODE` | Backend | Always | Public config | `local`, `e2b`, `e2b-sync`, or `e2b-async`. |
| `E2B_API_KEY` | Backend | `SANDBOX_MODE` uses E2B | Secret | E2B cloud sandbox. |

## Tool and Observability Variables

| Variable | Location | Required when | Security | Feature |
| --- | --- | --- | --- | --- |
| `TAVILY_API_KEY` | Backend | Web search | Secret | Search tool. |
| `COMPOSIO_API_KEY` | Backend | Composio integrations | Secret | Third-party app integrations. |
| `COMPOSIO_AUTH_CONFIGS_JSON` | Backend | Composio integrations | Server configuration | JSON map of app names to auth config IDs from the operator's Composio workspace. |
| `COMPOSIO_ALLOWED_ACTIONS_JSON` | Backend | Composio integrations | Server policy | Exact per-app `read` and `write` action allowlist. Missing or invalid JSON denies all action execution. |
| `LANGSMITH_API_KEY` | Backend | Backend tracing | Secret | LangSmith tracing. |
| `LANGSMITH_TRACING_V2` | Backend | Backend tracing | Public config | Enables tracing. |
| `LANGSMITH_PROJECT` | Backend | Backend tracing | Public config | Project name. |

## Google Drive Picker Variables

| Variable | Location | Required when | Security | Feature |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Frontend | Google Drive Picker | Public browser value | OAuth client ID. Restrict origins. |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | Frontend | Google Drive Picker | Public browser value | Google browser API key. Restrict referrers. |

## Safety Rules

- Never write server secrets into `frontend/.env.local` with a `NEXT_PUBLIC_` prefix.
- Never write `SUPABASE_SERVICE_KEY`, `DATABASE_URL`, provider API keys, or `E2B_API_KEY` into browser-exposed variables.
- Warn when `FILE_SECRET_KEY` or `IMAGE_SECRET_KEY` still contains `change-me`.
- Warn when no backend chat model key is present.
- Do not print full secret values. At most show the first and last two characters.
- Do not overwrite existing user `.env` values unless the user explicitly asks for overwrite behavior.
