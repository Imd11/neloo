# Neloo Frontend

This directory contains the Next.js frontend for Neloo. It provides the chat workspace, model selector, file and image surfaces, slides and resume tools, and browser-facing integrations.

The default assistant ID remains `data_analyst` for compatibility with the backend LangGraph configuration. It is a historical graph identifier, not the product name.

## Quick Start

From the repository root:

```bash
cd frontend
cp .env.example .env.local
yarn install
yarn dev
```

The app starts at `http://localhost:3000`. If that port is busy:

```bash
yarn next dev --turbopack --port 3001
```

Start the backend separately from `../backend` and keep `NEXT_PUBLIC_API_URL` pointed at it, usually `http://localhost:2024`.

## Configuration

Use `frontend/.env.example` as the template for local development. Production deployments usually configure the same values in Vercel.

Core frontend values:

```env
NEXT_PUBLIC_API_URL=http://localhost:2024
NEXT_PUBLIC_ASSISTANT_ID=data_analyst
```

Optional browser-facing integrations include Supabase anon access, Google Drive Picker keys, LangSmith client settings, and client-side slide/resume provider keys. Every `NEXT_PUBLIC_*` value is exposed in the browser bundle, so use restricted keys or move sensitive calls behind server routes before production use.

Server-side Next.js API routes can also use non-public variables such as:

```env
GEMINI_IMAGE_API_KEY=your-google-ai-studio-key
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
```

For the complete variable matrix, see [`../docs/configuration.md`](../docs/configuration.md).

## Model Selector

The top-left chat model selector is backed by the backend `/api/models` route. Configure chat model provider keys and base URLs in `backend/.env` or in the backend deployment environment. The frontend shows the canonical provider list and uses the backend `available` flag to indicate which models are ready.

## Project Structure

```text
frontend/
├── src/
│   ├── app/            # Next.js app routes and feature surfaces
│   ├── components/     # Shared UI components
│   ├── contexts/       # React context providers
│   └── lib/            # Shared frontend utilities and model metadata
├── public/             # Static assets and model/provider logos
├── package.json        # Frontend package metadata and scripts
└── .env.example        # Frontend environment template
```

## Development Checks

```bash
yarn lint
yarn build
```

Use Yarn 1.x for the most consistent install path with the checked-in lockfile.
