---
name: neloo-configurator
description: Configure the Neloo open-source project environment. Use when a user cloned Neloo and needs help setting up backend/.env, frontend/.env.local, Railway, Vercel, Supabase, E2B, chat model provider keys and base URLs, image generation keys, Google Drive, Tavily, Composio, LangSmith, or when diagnosing missing or unsafe Neloo environment variables.
---

# Neloo Configurator

## Overview

Use this skill to help users configure the Neloo repository for local development or production deployment. This skill is a setup assistant for external AI coding tools; it is not loaded by the Neloo runtime agent.

## Workflow

1. Confirm the current directory is the Neloo repository root. Look for `backend/.env.example`, `frontend/.env.example`, `backend/src/agent/graph.py`, and `frontend/src/lib/models.ts`.
2. Ask whether the user wants local development, production deployment, or diagnostics only.
3. Read `references/configuration-map.md` before giving detailed variable guidance or editing environment files.
4. For setup, run `node neloo-configurator/scripts/setup-env.mjs` with the appropriate profile:
   - `local-minimal` for chat plus trusted local execution.
   - `local-full` for local development with optional image/resume/slides defaults.
   - `production-railway-vercel` for Railway backend plus Vercel frontend.
5. Ask the user for real secrets only when needed. Do not print full secret values in responses or logs.
6. Run `node neloo-configurator/scripts/check-env.mjs` after setup or whenever diagnosing configuration.
7. Explain remaining errors and warnings in terms of affected features.
8. Give next startup commands only after required errors are resolved.

## Configuration Rules

- Keep backend secrets in `backend/.env` locally or Railway backend variables in production.
- Keep browser-safe public values and Next.js server-route secrets in `frontend/.env.local` locally or Vercel frontend variables in production.
- Treat every `NEXT_PUBLIC_*` value as visible to browser users.
- Do not place `SUPABASE_SERVICE_KEY`, `DATABASE_URL`, provider API keys, `E2B_API_KEY`, or database passwords in `NEXT_PUBLIC_*` variables.
- The top-left chat model selector is powered by backend model availability from `backend/src/agent/graph.py`; configure chat model keys and base URLs on the backend.
- Image generation uses server-side Next.js API route keys such as `NANOBANANA_IMAGE_API_KEY`, `NANOBANANA_IMAGE_BASE_URL`, `OPENAI_API_KEY`, and `OPENAI_IMAGE_MODEL`.
- Never commit generated `.env` files.

## Resources

- Read `references/configuration-map.md` for the complete variable matrix.
- Run `scripts/setup-env.mjs` to create local env files from templates and apply safe profile defaults.
- Run `scripts/check-env.mjs` to diagnose missing values and common security mistakes.

## Examples

Local minimal setup:

```bash
node neloo-configurator/scripts/setup-env.mjs --profile local-minimal
node neloo-configurator/scripts/check-env.mjs --profile local-minimal
```

Production-oriented setup:

```bash
node neloo-configurator/scripts/setup-env.mjs --profile production-railway-vercel
node neloo-configurator/scripts/check-env.mjs --profile production-railway-vercel
```

Dry run:

```bash
node neloo-configurator/scripts/setup-env.mjs --profile local-full --dry-run
```
