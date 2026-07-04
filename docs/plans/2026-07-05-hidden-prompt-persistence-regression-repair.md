# Hidden Prompt Persistence Regression Repair Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining hidden prompt acceptance gaps by making thread persistence, history reload, fork/regenerate, share, and database/API checks verifiable instead of skipped.

**Architecture:** Keep the existing hidden prompt envelope and sanitizer design. First reproduce and isolate the `/api/threads` persistence failure with backend API tests and local diagnostics, then make the smallest backend/storage/configuration fix needed so durable thread flows work. Finally rerun and record the browser/API/database regression checklist, and explicitly decide whether the existing LangGraph realtime stream exposure is accepted or requires a separate server-side proxy project.

**Tech Stack:** FastAPI backend, async Supabase client, LangGraph SDK, pytest, Next.js frontend, existing hidden prompt utilities in `frontend/src/app/utils/hiddenPromptEnvelope.ts` and backend sanitizer in `backend/src/hidden_prompt_sanitization.py`.

---

### Task 0: Confirm Scope, Baseline, And Current Failure

**Files:**
- Review only: `docs/plans/2026-07-05-hidden-prompt-sanitization-followup-repair.md`
- Review only: `docs/plans/hidden-template-prefix-regression-check.md`
- Review only: `backend/src/api/webapp.py`
- Review only: `backend/src/storage/supabase_db.py`
- Review only: `backend/src/hidden_prompt_sanitization.py`
- Review only: `frontend/src/app/hooks/useChat.ts`

**Step 1: Confirm clean git state and remote sync**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
```

Expected: worktree is clean, branch is `main`, and local `HEAD` equals `origin/main`. If unrelated dirty files exist, stop and report them before touching anything.

**Step 2: Re-read the previous regression result**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
sed -n '48,80p' docs/plans/hidden-template-prefix-regression-check.md
```

Expected: confirm the skipped/partial blockers are exactly:

- `/api/threads` returned `500: Failed to create thread`
- generated thread IDs returned `404: Thread not found`
- refresh/history, fork/regenerate, share, and DB spot check were not fully verified
- `/runs/stream` included the model-facing hidden prompt

**Step 3: Reproduce the API-level persistence failure directly**

Start the backend with the repo's normal command, then in another terminal run:

```bash
cd /Users/yang/Desktop/agent/neloo
THREAD_ID="hidden-prompt-regression-$(uuidgen | tr 'A-Z' 'a-z')"
curl -sS -i \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: hidden-prompt-test-user' \
  -d "{\"langgraph_thread_id\":\"$THREAD_ID\",\"title\":\"Hidden prompt regression\",\"mode\":\"default\",\"model_id\":\"deepseek\"}" \
  http://127.0.0.1:2024/api/threads
```

Expected before repair: either the same `500` seen in the browser checklist, or a clear `503 Database not configured` if Supabase is intentionally absent. Record the exact status and body in notes before changing code.

**Step 4: Capture backend logs for the failing request**

Inspect the backend terminal output around the request. Look for:

- `[SupabaseDB] Error creating thread: ...`
- `Failed to create thread: ...`
- missing table/column errors such as `model_id`, `parent_thread_id`, `shared_conversations`, or `chat_messages`
- Supabase authentication/permission errors

Expected: one concrete root cause. Do not guess. The rest of this plan depends on the observed failure.

**Step 5: Commit nothing**

Expected: Task 0 is diagnostic only.

---

### Task 1: Add Backend API Regression Tests For Durable Hidden Prompt Flows

**Files:**
- Create: `backend/tests/test_hidden_prompt_api_flows.py`
- Modify only if needed: `backend/tests/conftest.py`

**Step 1: Write isolated API tests with monkeypatched storage**

Create `backend/tests/test_hidden_prompt_api_flows.py` with tests that do not require real Supabase credentials. Use FastAPI `TestClient` or `httpx` ASGI client, and monkeypatch the storage functions imported into `backend/src/api/webapp.py`.

Test cases:

1. `POST /api/threads` returns a durable thread response when `create_thread` returns a record.
2. `POST /api/threads/{thread_id}/messages` sanitizes a hidden prompt envelope before calling `save_chat_message`.
3. `POST /api/threads/{thread_id}/messages` strips a legacy prompt prefix before calling `save_chat_message`.
4. `GET /api/share/{share_id}` sanitizes LangGraph state messages before returning them.
5. `POST /api/threads/{thread_id}/fork` copies already sanitized `chat_messages` rows to the new thread.

Use helper data like:

```python
HIDDEN_USER_MESSAGE = {
    "id": "human-1",
    "type": "human",
    "content": "You are a senior prompt engineer.\n\nsecret template\n\nmake a hero prompt",
    "additional_kwargs": {
        "neloo_hidden_prompt": {
            "visibleContent": "make a hero prompt",
            "context": {"feature": "prompt-optimize", "templateId": 1},
        }
    },
}
```

Expected assertions:

```python
assert saved_message_data["content"] == "make a hero prompt"
assert "You are a senior prompt engineer" not in repr(saved_message_data)
assert response.json()["messages"][0]["content"] == "make a hero prompt"
```

**Step 2: Run the new tests and verify the current behavior**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/backend
python3.13 -m pytest tests/test_hidden_prompt_api_flows.py -q
```

Expected: tests should either pass for already-correct sanitization paths or fail with a precise route/storage issue. If tests cannot import the app cleanly, fix only test setup/import isolation, not product behavior.

**Step 3: Run the existing sanitizer tests**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/backend
python3.13 -m pytest tests/test_hidden_prompt_sanitization.py -q
```

Expected: PASS. If this fails, stop and fix the sanitizer regression before continuing.

**Step 4: Commit the API tests**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git add backend/tests/test_hidden_prompt_api_flows.py backend/tests/conftest.py
git commit -m "test: cover hidden prompt persistence api flows"
```

Expected: commit contains only backend tests/test setup.

---

### Task 2: Fix The `/api/threads` Persistence Failure With The Smallest Correct Change

**Files:**
- Modify only if root cause is code: `backend/src/storage/supabase_db.py`
- Modify only if root cause is route behavior: `backend/src/api/webapp.py`
- Modify only if root cause is missing migration/schema docs: `supabase/migrations/*.sql`
- Modify only if root cause is configuration docs: `README.md`, `neloo-configurator/references/configuration-map.md`, `neloo-configurator/scripts/check-env.mjs`

**Step 1: Classify the Task 0 failure**

Use the captured status/body/logs to classify the failure into exactly one bucket:

- `missing-config`: backend returned `503 Database not configured`
- `missing-schema`: Supabase says a table/column/relation does not exist
- `storage-bug`: Supabase is configured and schema exists, but code inserts/queries the wrong fields
- `auth-user-mismatch`: thread is created for one user and read as another user
- `runtime-thread-only`: LangGraph runtime thread exists but app database thread does not

Expected: one bucket with evidence.

**Step 2A: If `missing-config`, do not make code pretend persistence works**

Update documentation/check tooling only:

- `README.md`: state that history, share, fork/regenerate, DB spot checks require `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`.
- `neloo-configurator/references/configuration-map.md`: mark these features as Supabase-backed.
- `neloo-configurator/scripts/check-env.mjs`: warn that `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` are required for durable history/share/fork.

Expected: local no-DB mode can still chat, but durable history/share/fork are clearly marked unavailable.

**Step 2B: If `missing-schema`, add or fix a migration**

Inspect current migrations:

```bash
cd /Users/yang/Desktop/agent/neloo
find supabase/migrations -type f | sort
rg -n "create table.*threads|model_id|parent_thread_id|fork_target_ai_message_id|fork_anchor_human_message_id|chat_messages|shared_conversations" supabase/migrations
```

Add a new migration with only missing columns/tables. Use `if not exists` where possible. Do not rewrite old migrations.

Expected minimum schema support:

- `threads.id`
- `threads.user_id`
- `threads.title`
- `threads.langgraph_thread_id`
- `threads.mode`
- `threads.model_id`
- `threads.parent_thread_id`
- `threads.fork_target_ai_message_id`
- `threads.fork_anchor_human_message_id`
- `chat_messages.thread_id`
- `chat_messages.message_id`
- `chat_messages.role`
- `chat_messages.message_data`
- `chat_messages.seq`
- `shared_conversations.share_id`
- `shared_conversations.thread_id`
- `shared_conversations.user_id`
- `shared_conversations.target_ai_message_id`
- `shared_conversations.created_at`

**Step 2C: If `storage-bug`, fix only the failing storage helper**

Likely candidates:

- `backend/src/storage/supabase_db.py:create_thread`
- `backend/src/storage/supabase_db.py:create_thread_with_fork`
- `backend/src/storage/supabase_db.py:copy_messages_to_thread`
- `backend/src/storage/supabase_db.py:create_share`

Rules:

- Preserve existing ids and field names used by the frontend.
- Do not store full hidden prompt text.
- Do not add broad fallback storage that silently drops errors.
- Return useful logs for failed inserts, but do not print API keys or Supabase service keys.

**Step 2D: If `auth-user-mismatch`, align local user identity**

Inspect requests from `frontend/src/app/hooks/useChat.ts`, `frontend/src/app/components/ChatInterface.tsx`, and `frontend/src/app/components/AppSidebar.tsx`.

Expected fix shape:

- every thread create/read/update/share/fork call uses the same local user identity when auth is absent
- no login requirement is reintroduced
- existing `x-user-id` fallback in `backend/src/api/auth.py` remains compatible

**Step 2E: If `runtime-thread-only`, repair sequencing**

Expected fix shape:

- app database thread is created before message save/share/fork flows rely on it
- `save_thread_message` should not silently save messages against a missing app thread if the route contract requires durable history
- no hidden prompt full text is persisted while fixing sequencing

**Step 3: Run targeted backend tests**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/backend
python3.13 -m pytest tests/test_hidden_prompt_sanitization.py tests/test_hidden_prompt_api_flows.py -q
python3 -m compileall src
```

Expected: all pass.

**Step 4: Re-run the direct curl reproduction**

Run the same `POST /api/threads` curl from Task 0.

Expected after repair:

- with Supabase configured: `200` and a valid thread JSON body
- without Supabase configured: `503 Database not configured`, and README/configurator clearly explain durable history/share/fork are unavailable until configured

**Step 5: Commit**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git add backend/src/storage/supabase_db.py backend/src/api/webapp.py supabase/migrations README.md neloo-configurator/references/configuration-map.md neloo-configurator/scripts/check-env.mjs
git commit -m "fix: repair durable thread persistence setup"
```

Expected: commit contains only the minimal files needed for the classified root cause. If only docs/check tooling changed, use `docs:` instead of `fix:`.

---

### Task 3: Add API-Level Regression Script For Hidden Prompt History/Share/Fork

**Files:**
- Create: `backend/scripts/check_hidden_prompt_persistence.py`
- Modify: `docs/plans/hidden-template-prefix-regression-check.md`

**Step 1: Create a deterministic backend check script**

Create `backend/scripts/check_hidden_prompt_persistence.py` that:

1. Accepts `--base-url`, default `http://127.0.0.1:2024`.
2. Uses `x-user-id: hidden-prompt-regression-user`.
3. Creates a thread through `POST /api/threads`.
4. Saves a hidden-prompt-envelope human message through `POST /api/threads/{thread_id}/messages`.
5. Saves a minimal assistant response.
6. Reads thread metadata through `GET /api/threads/{thread_id}`.
7. Creates a share through `POST /api/threads/{thread_id}/share`.
8. Reads share through `GET /api/share/{share_id}`.
9. Optionally calls fork if enough saved messages exist.
10. Fails if any API JSON response contains these forbidden strings:

```python
FORBIDDEN = [
    "You are a senior prompt engineer.",
    "Act like a professional content writer",
    "Analysis direction:",
    "[System: You are now acting as the agent",
]
```

Expected: the script exits non-zero on hidden prompt exposure or durable API failure.

**Step 2: Run script against a configured backend**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/backend
python3 scripts/check_hidden_prompt_persistence.py --base-url http://127.0.0.1:2024
```

Expected with Supabase configured: PASS.

Expected without Supabase configured: clear SKIP/FAIL message explaining `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are required for durable history/share/fork verification. Do not mark browser acceptance complete in this case.

**Step 3: Document the script in the regression checklist**

Append to `docs/plans/hidden-template-prefix-regression-check.md` under backend/API checks:

```markdown
### Automated Backend Persistence Check

Run:

```bash
cd backend
python3 scripts/check_hidden_prompt_persistence.py --base-url http://127.0.0.1:2024
```

This must pass before marking history/share/fork hidden prompt persistence as verified.
```

**Step 4: Commit**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git add backend/scripts/check_hidden_prompt_persistence.py docs/plans/hidden-template-prefix-regression-check.md
git commit -m "test: add hidden prompt persistence regression check"
```

Expected: commit contains only the script and checklist update.

---

### Task 4: Complete Browser Regression Checklist With Real PASS/FAIL Evidence

**Files:**
- Modify: `docs/plans/hidden-template-prefix-regression-check.md`

**Step 1: Start backend and frontend normally**

Run the repo's existing commands. Before starting, inspect scripts:

```bash
cd /Users/yang/Desktop/agent/neloo
cat frontend/package.json
cat backend/pyproject.toml
```

Expected: frontend and backend are reachable, using the same backend URL the app is configured to call.

**Step 2: Complete the UI checklist**

Using the browser, complete every item in:

```bash
/Users/yang/Desktop/agent/neloo/docs/plans/hidden-template-prefix-regression-check.md
```

Required final states:

- Prompt Optimize submit: PASS
- Prompt Optimize refresh/history: PASS or explicit Supabase-not-configured SKIP
- Humanize submit/history: PASS or explicit Supabase-not-configured SKIP
- Fortune submit/history: PASS or explicit Supabase-not-configured SKIP
- Regenerate: PASS
- Fork/regenerate: PASS or explicit Supabase-not-configured SKIP
- Share page/API: PASS or explicit Supabase-not-configured SKIP
- DB spot check: PASS or explicit Supabase-not-configured SKIP

Do not keep vague `SKIPPED/PARTIAL` wording. Every skipped item must name the exact missing prerequisite.

**Step 3: Verify forbidden strings in page text and API responses**

For each tested flow, search visible page text and captured API JSON for:

- `You are a senior prompt engineer.`
- `Act like a professional content writer`
- `Analysis direction:`
- `[System: You are now acting as the agent`

Expected: no forbidden strings in visible UI, history API human content, share API human content, copied text, or forked thread visible content.

**Step 4: Update execution results**

Replace the old `Execution Results - 2026-07-05` section with a new section:

```markdown
## Execution Results - 2026-07-05 Repair Pass

- Frontend URL: `<actual URL>`
- Backend URL: `<actual URL>`
- Supabase durable persistence configured: YES/NO
- Backend persistence script: PASS/SKIP/FAIL, notes
- Prompt Optimize submit: PASS/FAIL, notes
- Prompt Optimize refresh/history response: PASS/SKIP/FAIL, notes
- Humanize submit/history: PASS/SKIP/FAIL, notes
- Fortune submit/history: PASS/SKIP/FAIL, notes
- Regenerate: PASS/FAIL, notes
- Fork/regenerate: PASS/SKIP/FAIL, notes
- Share page/API: PASS/SKIP/FAIL, notes
- DB spot check: PASS/SKIP/FAIL, notes
- Forbidden visible/API strings: PASS/FAIL, notes
- Blockers or skipped checks: `<none or concrete missing prerequisite>`
```

Expected: the document no longer leaves durable flows in ambiguous `SKIPPED/PARTIAL` state.

**Step 5: Commit**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git add docs/plans/hidden-template-prefix-regression-check.md
git commit -m "test: complete hidden prompt persistence regression evidence"
```

Expected: commit contains only updated verification evidence.

---

### Task 5: Make The `/runs/stream` Exposure Decision Explicit

**Files:**
- Create: `docs/plans/2026-07-05-hidden-prompt-stream-exposure-decision.md`
- Modify only if decision is documentation-only: `README.md`

**Step 1: Document the current architecture fact**

Create `docs/plans/2026-07-05-hidden-prompt-stream-exposure-decision.md` with:

```markdown
# Hidden Prompt Stream Exposure Decision

## Current Fact

Neloo currently sends model-facing hidden prompt content from the browser to the LangGraph realtime `/runs/stream` endpoint. The hidden text is not shown in chat bubbles, copy, history, share, or persisted user message content after the sanitizer repairs, but it can be observed by a user inspecting their own browser network traffic.

## Decision

Accepted for this release / Not accepted for this release.

## If Accepted

Document this as implementation detail for template behavior. Do not claim hidden template prompts are secret from the local user.

## If Not Accepted

Create a separate server-side proxy plan. The browser should send only visible user input plus a feature/template id to the backend, and the backend should assemble model-facing prompts server-side before calling LangGraph/model providers.
```

**Step 2: Choose the release decision**

If the product requirement is only “not visible/persisted/shared,” choose `Accepted for this release` and update README wording to avoid overclaiming secrecy.

If the product requirement is “users must not be able to see hidden templates in DevTools,” choose `Not accepted for this release` and do not claim this repair plan fully solves hidden prompt secrecy. Write a follow-up implementation plan for a backend prompt proxy.

Expected: no ambiguous statement like “hidden prompts are never exposed” unless `/runs/stream` is also fixed.

**Step 3: Commit**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git add docs/plans/2026-07-05-hidden-prompt-stream-exposure-decision.md README.md
git commit -m "docs: record hidden prompt stream exposure decision"
```

Expected: commit contains only decision documentation and any README wording correction.

---

### Task 6: Final Verification Before Push

**Files:**
- Verify only

**Step 1: Run backend verification**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/backend
python3.13 -m pytest tests/test_hidden_prompt_sanitization.py tests/test_hidden_prompt_api_flows.py -q
python3 -m compileall src
```

Expected: PASS.

**Step 2: Run backend persistence script**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/backend
python3 scripts/check_hidden_prompt_persistence.py --base-url http://127.0.0.1:2024
```

Expected with Supabase configured: PASS. If Supabase is intentionally not configured, result may be SKIP/FAIL with exact prerequisite, but then durable browser checklist items must also remain explicitly marked unavailable, not passed.

**Step 3: Run frontend verification**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
node scripts/check-hidden-prompt-envelope.mjs
npx eslint src/app/hooks/useChat.ts src/app/utils/hiddenPromptEnvelope.ts
yarn build
```

Expected: PASS. Existing unrelated warnings are acceptable only if recorded.

**Step 4: Run hidden prompt string search**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
rg -n "You are a senior prompt engineer\\.|Act like a professional content writer|Analysis direction:|\\[System: You are now acting as the agent" frontend/src backend/src docs/plans README.md neloo-configurator
```

Expected: matches are explainable and limited to active prompt definitions, sanitizer/test code, explicit verification docs, and the stream exposure decision. No obsolete process docs or user-facing claims should contain misleading hidden prompt bodies.

**Step 5: Confirm git state**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git status --short
git log --oneline -8
```

Expected: worktree clean and recent commits match this plan.

---

### Task 7: Push And Final Report

**Files:**
- Verify only

**Step 1: Push**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git push origin main
```

Expected: push succeeds.

**Step 2: Final user-facing report**

Report:

- exact latest commit hash
- exact verification commands that passed
- whether Supabase durable persistence was configured
- whether history reload, fork/regenerate, share, and DB spot check passed or were explicitly unavailable due missing Supabase config
- whether `/runs/stream` exposure is accepted for this release or requires follow-up
- final user-visible behavior:
  - normal chat bubbles show only the user's visible input
  - history/share/fork visible content does not show hidden template instructions when durable persistence is configured
  - regenerate preserves template behavior for Prompt Optimize, Humanize, and Fortune without persisting full hidden prompts

