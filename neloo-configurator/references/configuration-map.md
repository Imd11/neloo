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

## Required Minimal Local Setup

| Variable | Location | Required when | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | Always | Browser URL for the backend, usually `http://localhost:2024`. |
| `NEXT_PUBLIC_ASSISTANT_ID` | `frontend/.env.local` | Recommended | Keep `data_analyst` unless graph IDs change. |
| `API_BASE_URL` | `backend/.env` | Recommended | Backend public URL, usually `http://localhost:2024`. |
| `FRONTEND_URL` | `backend/.env` | Recommended | Frontend URL, usually `http://localhost:3000` or `http://localhost:3001`. |
| `CORS_ALLOWED_ORIGINS` | `backend/.env` | Recommended | Include every frontend origin. |
| `SANDBOX_MODE` | `backend/.env` | Always | Use `local` for trusted local development. |
| One chat model key | `backend/.env` | Always for chat | At least one key from the chat model provider table. |

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
| `ENABLE_HITL` | Backend | Optional | Public | Human-in-the-loop toggles. |

## Frontend Variables

| Variable | Location | Required when | Security | Feature |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Frontend | Always | Public browser value | Connects frontend to backend. |
| `NEXT_PUBLIC_ASSISTANT_ID` | Frontend | Recommended | Public browser value | Default graph ID. |
| `NEXT_PUBLIC_LANGSMITH_API_KEY` | Frontend | Optional | Public browser value | LangSmith client integrations. |
| `NEXT_PUBLIC_BACKEND_URL` | Frontend | Resume routes using legacy helpers | Public browser value | Historical resume backend URL. Usually same as `NEXT_PUBLIC_API_URL`. |

## Chat Model Provider Variables

These are backend secrets. Configure them in `backend/.env` locally or Railway in production. The top-left model selector reads `/api/models`, and the backend marks each model available if the corresponding key is present.

| UI models | Model IDs | Key variable | Base URL variable | Default / expected URL | Security |
| --- | --- | --- | --- | --- | --- |
| DeepSeek V3.2, DeepSeek V3.2 thinking | `deepseek-chat`, `deepseek-reasoner` | `DEEPSEEK_API_KEY` | None | Native DeepSeek provider | Secret |
| Qwen Plus, Qwen3 Max | `qwen-plus`, `qwen3-max` | `QWEN_API_KEY` | `QWEN_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | Secret |
| MiniMax M2.1 | `minimax-m2` | `MINIMAX_API_KEY` | `MINIMAX_ANTHROPIC_BASE_URL` | Anthropic-compatible MiniMax endpoint | Secret |
| Claude Opus via OpenRouter | `claude-opus-or` | `OPENROUTER_API_KEY` | `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Secret |
| Llama via OpenRouter | `llama-4-maverick`, `llama-3.3-70b` | `OPENROUTER_API_KEY` | `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Secret |
| GLM-4.7 | `glm-4.7` | `ZHIPU_API_KEY` | `ZHIPU_BASE_URL` | Zhipu OpenAI-compatible endpoint | Secret |
| Claude via NewAPI / Right Code | `claude-opus-right`, `claude-sonnet-right` | `NEWAPI_API_KEY` | `NEWAPI_BASE_URL` | OpenAI-compatible gateway URL | Secret |
| Claude thinking via NewAPI / Right Code | `claude-opus-right-thinking`, `claude-sonnet-right-thinking` | `NEWAPI_API_KEY` | `NEWAPI_ANTHROPIC_BASE_URL` | Anthropic-compatible gateway URL | Secret |
| Gemini / GPT through Tu-Zi | `gemini-3-pro`, `gpt-5`, `gpt-5-thinking` | `TUZI_API_KEY` | `TUZI_BASE_URL` | `https://api.tu-zi.com/v1` | Secret |
| Claude thinking through Tu-Zi | `claude-opus-tuzi` | `TUZI_ANTHROPIC_API_KEY` | `TUZI_ANTHROPIC_BASE_URL` | Tu-Zi Anthropic-compatible URL | Secret |
| OpenAI direct / embeddings | Fallbacks, RAG | `OPENAI_API_KEY` | None | Native OpenAI provider | Secret |
| Anthropic direct | Fallbacks | `ANTHROPIC_API_KEY` | `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | Secret |

## Image Generation Variables

| Variable | Location | Required when | Security | Feature |
| --- | --- | --- | --- | --- |
| `NANOBANANA_IMAGE_API_KEY` | Frontend environment / Vercel server-side | Using `/api/generate-image` or `/api/edit` | Secret, do not prefix with `NEXT_PUBLIC_` | Next.js image generation and editing routes. |
| `NEXT_PUBLIC_IMAGE_API_URL` | Frontend | Image helper clients | Public browser value | Image API base URL. Defaults to `https://api.tu-zi.com`. |
| `NEXT_PUBLIC_TUZI_API_KEY` | Frontend | Slides text generation and some image flows | Public browser value | Tu-Zi browser-side slides calls. Use restricted keys only. |
| `NEXT_PUBLIC_TUZI_IMAGE_API_KEY` | Frontend | Slides image generation | Public browser value | Tu-Zi browser-side image calls. Falls back to `NEXT_PUBLIC_TUZI_API_KEY` in some code paths. |
| `NEXT_PUBLIC_DEEPSEEK_API_KEY` | Frontend | Slidecraft flows | Public browser value | Browser-side DeepSeek calls. Prefer backend proxy for production. |
| `NEXT_PUBLIC_QWEN_API_KEY` | Frontend | Resume parser flows | Public browser value | Browser-side Qwen calls. Prefer backend proxy for production. |

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

## Persistence and Storage Variables

| Variable | Location | Required when | Security | Feature |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Backend | Production thread/checkpoint persistence | Secret | Postgres connection string, often injected by Railway. |
| `FILE_SECRET_KEY` | Backend | Production file links | Secret | Signs file URLs. Replace default `change-me` value. |
| `IMAGE_SECRET_KEY` | Backend | Production image links | Secret | Signs image URLs. Replace default `change-me` value. |
| `FILE_USE_LOCAL_STORAGE` | Backend | Storage selection | Public config | `true` forces local file storage. |
| `IMAGE_USE_LOCAL_STORAGE` | Backend | Storage selection | Public config | `true` forces local image storage. |

## Sandbox Variables

| Variable | Location | Required when | Security | Feature |
| --- | --- | --- | --- | --- |
| `SANDBOX_MODE` | Backend | Always | Public config | `local`, `docker`, `e2b`, `e2b-sync`, or `e2b-async`. |
| `E2B_API_KEY` | Backend | `SANDBOX_MODE` uses E2B | Secret | E2B cloud sandbox. |

## Tool and Observability Variables

| Variable | Location | Required when | Security | Feature |
| --- | --- | --- | --- | --- |
| `TAVILY_API_KEY` | Backend | Web search | Secret | Search tool. |
| `COMPOSIO_API_KEY` | Backend | Composio integrations | Secret | Third-party app integrations. |
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
