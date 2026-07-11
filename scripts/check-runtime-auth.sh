#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

export ALLOW_ANONYMOUS=true
export ALLOW_INSECURE_LOCAL_TOKENS=false
export ANONYMOUS_SESSION_SECRET=test-anonymous-secret-at-least-32-bytes # gitleaks:allow
export DEEPSEEK_API_KEY=test-runtime-auth-key

.venv/bin/pytest \
  tests/integration/test_runtime_auth_boundary.py \
  tests/integration/test_thread_owner_backfill.py \
  -q
