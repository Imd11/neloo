# Neloo Backend

This directory contains the LangGraph and FastAPI backend for Neloo, a general-purpose AI agent workspace. The backend owns chat model routing, tool execution, sandbox access, file/image storage, thread persistence, and API routes used by the frontend.

The built-in LangGraph assistant ID is still `data_analyst` for compatibility with existing stored threads and deployments. Treat it as an internal graph identifier, not the product name.

## Quick Start

From the repository root:

```bash
cd backend
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

Edit `backend/.env` and configure at least one complete chat model provider. For the smallest trusted local setup:

```env
SANDBOX_MODE=local
DEEPSEEK_API_KEY=your-deepseek-api-key
```

Then start the backend:

```bash
langgraph dev --host 127.0.0.1 --port 2024
```

The local API is available at `http://localhost:2024`.

## Local vs Production Persistence

`langgraph.json` is the default local development config and does not require `DATABASE_URL`.

`langgraph.production.json` enables Postgres-backed LangGraph checkpoints and store. Use it for Railway or other production deployments and set:

```env
DATABASE_URL=postgresql://...
```

## Configuration

Use `backend/.env.example` as the template for local development. Production deployments usually configure the same values in Railway or another backend host.

Common backend configuration areas:

- Server URLs and CORS: `API_BASE_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`
- Chat models: provider keys, `*_BASE_URL`, and `*_MODEL` variables
- Sandbox execution: `SANDBOX_MODE`, `E2B_API_KEY`
- Supabase and database persistence: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DATABASE_URL`
- Storage signing: `FILE_SECRET_KEY`, `IMAGE_SECRET_KEY`
- Optional integrations: `TAVILY_API_KEY`, `COMPOSIO_API_KEY`, `LANGSMITH_API_KEY`

For the complete variable matrix, see [`../docs/configuration.md`](../docs/configuration.md).

## Project Structure

```text
backend/
├── src/
│   ├── agent/          # LangGraph graph, prompts, model registry, middleware
│   ├── api/            # FastAPI routes consumed by the frontend
│   ├── sandbox/        # Local, Docker, and E2B code execution backends
│   ├── storage/        # File, image, Supabase, and database helpers
│   └── tools/          # Agent tools for search, code, documents, and integrations
├── supabase/           # Backend-specific Supabase migrations
├── tests/              # Backend tests
├── langgraph.json      # LangGraph graph and HTTP app configuration
├── pyproject.toml      # Python package metadata and dependencies
└── .env.example        # Backend environment template
```

## Sandbox Modes

| Mode | Use case | Isolation |
| --- | --- | --- |
| `local` | Trusted local development | None |
| `docker` | Local container execution | Container isolation |
| `e2b`, `e2b-sync`, `e2b-async` | Cloud sandbox execution | E2B-managed isolation |

Use `local` only with trusted prompts and files. For production, prefer E2B or another isolated execution mode.

## Development Checks

```bash
python -m py_compile src/model_ids.py src/agent/graph.py src/api/webapp.py src/storage/supabase_db.py
python -m pytest tests
```

Some tests require optional services or environment variables. Configure them through `backend/.env` when needed.
