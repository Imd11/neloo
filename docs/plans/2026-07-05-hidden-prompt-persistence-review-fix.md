# Hidden Prompt Persistence Review Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the review findings for the hidden prompt persistence repair so the new tests are open-source/CI safe and the durable Supabase verification state is recorded honestly.

**Architecture:** Keep the existing hidden prompt persistence implementation unchanged unless a test reveals a real defect. Make backend API tests self-contained by providing deterministic dummy environment values before importing the FastAPI app, so tests never depend on a developer's private `.env`. Keep the durable Supabase end-to-end check as an explicit PASS/SKIP verification artifact with a clear prerequisite.

**Tech Stack:** Python 3.13, pytest, FastAPI TestClient, Supabase-backed thread persistence, LangGraph SDK, Markdown verification docs.

---

### Task 1: Make Backend Hidden Prompt API Tests Independent Of Private `.env`

**Files:**
- Modify: `backend/tests/test_hidden_prompt_api_flows.py:1-12`

**Step 1: Confirm the current test import reads local `.env`**

Inspect the top of the test file:

```bash
cd /Users/yang/Desktop/agent/neloo
sed -n '1,20p' backend/tests/test_hidden_prompt_api_flows.py
```

Expected: the file imports `load_dotenv` and calls `load_dotenv(override=True)` before importing `src.api.webapp`.

**Step 2: Replace local `.env` dependency with deterministic dummy env defaults**

Edit `backend/tests/test_hidden_prompt_api_flows.py` so the app import is preceded by explicit test-only environment defaults. Do not load private `.env` values.

Use this shape at the top of the file:

```python
import os
import sys
from types import SimpleNamespace

from fastapi.testclient import TestClient

def set_test_env_default(name, value):
    if not os.environ.get(name):
        os.environ[name] = value


set_test_env_default("DEEPSEEK_API_KEY", "test-deepseek-key")
set_test_env_default("SANDBOX_MODE", "local")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.api import webapp
from src.storage import supabase_db
```

Rules:
- Remove `from dotenv import load_dotenv`.
- Remove `load_dotenv(override=True)`.
- Keep dummy values obviously fake.
- Treat missing and empty env values as unconfigured, then fill test-only dummy defaults before importing the app.
- Do not use a dummy `DEEPSEEK_API_BASE`; the current DeepSeek model slot only requires `DEEPSEEK_API_KEY`.
- Do not set dummy `SUPABASE_URL` or `SUPABASE_SERVICE_KEY`; those are import-time storage flags and would make unrelated tests think Supabase is configured.
- Do not introduce real API keys, real Supabase hosts, or user-specific paths.

**Step 3: Run the focused test file**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/backend
python3.13 -m pytest tests/test_hidden_prompt_api_flows.py -q
```

Expected: all tests in `test_hidden_prompt_api_flows.py` pass.

**Step 4: Run the full hidden prompt backend test subset**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/backend
python3.13 -m pytest tests/test_hidden_prompt_sanitization.py tests/test_hidden_prompt_api_flows.py -q
```

Expected: all tests pass without requiring any local `.env` file.

**Step 5: Commit**

```bash
cd /Users/yang/Desktop/agent/neloo
git add backend/tests/test_hidden_prompt_api_flows.py
git commit -m "test: remove private env dependency from hidden prompt api tests"
```

---

### Task 2: Add A Clean-Environment Regression Check For Test Import Safety

**Files:**
- Modify: `docs/plans/hidden-template-prefix-regression-check.md:59-77`

**Step 1: Run the backend API test with environment variables ignored where practical**

Because `pytest` itself still needs the normal shell `PATH`, use the deterministic dummy envs from Task 1 as the safety mechanism. Run:

```bash
cd /Users/yang/Desktop/agent/neloo/backend
env -u DEEPSEEK_API_KEY -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u QWEN_API_KEY python3.13 -m pytest tests/test_hidden_prompt_api_flows.py -q
```

Expected: tests pass because `test_hidden_prompt_api_flows.py` fills required fake defaults when provider env values are missing or empty.

If this fails during import with a missing model key, go back to Task 1 and fix the import-time dummy env setup.

**Step 2: Update the repair checklist with the result**

In `docs/plans/hidden-template-prefix-regression-check.md`, add one bullet under `## Execution Results - 2026-07-05 Repair Pass`:

```markdown
- Backend API test env isolation: PASS. `tests/test_hidden_prompt_api_flows.py` now sets deterministic dummy model env defaults before importing the app and does not load a private `.env`; it intentionally does not set dummy Supabase env values.
```

Do not claim that real Supabase durable history passed unless the persistence script actually exits `0`.

**Step 3: Commit**

```bash
cd /Users/yang/Desktop/agent/neloo
git add docs/plans/hidden-template-prefix-regression-check.md
git commit -m "docs: record hidden prompt test env isolation"
```

---

### Task 3: Re-run Durable Persistence Script And Preserve Honest PASS/SKIP State

**Files:**
- Modify only if needed: `docs/plans/hidden-template-prefix-regression-check.md:59-77`

**Step 1: Run the existing persistence checker**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/backend
python3.13 scripts/check_hidden_prompt_persistence.py --base-url http://127.0.0.1:2024
```

Expected outcomes:
- If Supabase is reachable and migrations exist: script exits `0` and prints a PASS-style success message.
- If Supabase is not reachable/configured: script exits `2` and prints `SKIP: durable thread persistence unavailable...`.
- Any other exception or exit code is a failure to investigate before moving on.

**Step 2: Update the checklist only if the state changed**

If the script exits `0`, replace the existing SKIP bullets for durable refresh/history, fork/regenerate, share, and DB spot check with PASS evidence that includes the command and timestamp.

If the script exits `2`, keep the current SKIP state. Do not edit the doc just to reword it.

**Step 3: Commit only if the doc changed**

```bash
cd /Users/yang/Desktop/agent/neloo
git add docs/plans/hidden-template-prefix-regression-check.md
git commit -m "docs: update hidden prompt durable persistence verification"
```

If there was no doc change, do not create an empty commit.

---

### Task 4: Final Verification

**Files:**
- No expected edits.

**Step 1: Run hidden prompt backend tests**

```bash
cd /Users/yang/Desktop/agent/neloo/backend
python3.13 -m pytest tests/test_hidden_prompt_sanitization.py tests/test_hidden_prompt_api_flows.py -q
```

Expected: PASS.

**Step 2: Compile backend source**

```bash
cd /Users/yang/Desktop/agent/neloo/backend
python3.13 -m compileall src
```

Expected: completes without syntax errors.

**Step 3: Run hidden prompt frontend checks**

```bash
cd /Users/yang/Desktop/agent/neloo
node frontend/scripts/check-hidden-prompt-envelope.mjs
```

Expected: exit code `0`.

**Step 4: Run frontend lint for the touched hidden prompt files**

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
npx eslint src/app/hooks/useChat.ts src/app/utils/hiddenPromptEnvelope.ts
```

Expected: exit code `0`.

**Step 5: Confirm git state**

```bash
cd /Users/yang/Desktop/agent/neloo
git status --short
git log --oneline -5
```

Expected: clean worktree, with the new test/docs commits at the top.

---

### Task 5: Push To GitHub Main

**Files:**
- No file edits.

**Step 1: Push**

```bash
cd /Users/yang/Desktop/agent/neloo
git push origin main
```

Expected: push succeeds and `origin/main` contains the new commits.

**Step 2: Confirm local and remote match**

```bash
cd /Users/yang/Desktop/agent/neloo
git rev-parse HEAD
git rev-parse origin/main
```

Expected: both hashes match.

---

### Acceptance Criteria

- `backend/tests/test_hidden_prompt_api_flows.py` no longer imports or calls `dotenv.load_dotenv`.
- Hidden prompt API tests pass without relying on a developer's private `.env`.
- Durable Supabase verification is either:
  - `PASS` with command evidence, or
  - explicitly `SKIP` with the exact prerequisite: reachable `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and completed migrations.
- No production code is changed unless a verification failure proves it is necessary.
- All final verification commands pass, except the durable persistence script may exit `2` only when documented as an expected Supabase prerequisite.
- Changes are committed and pushed to `origin/main`.
