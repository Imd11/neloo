# Fix Plan EOF Whitespace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the trailing blank line that makes the latest plan-document commit fail `git diff --check`.

**Architecture:** Make a one-line Markdown cleanup in the existing plan file, then rerun the same validation gates that failed during review. Do not change application code, model registry logic, README content, configurator behavior, or tests unless verification reveals a directly related failure.

**Tech Stack:** Markdown, Git whitespace checks, Node.js `node:test`, Python compile checks, pytest, ESLint.

---

## Current Failure

The current `main` branch is synced with `origin/main`, but the most recent commit fails Git whitespace validation:

```text
docs/plans/2026-06-28-model-selector-config-fixes.md:672: new blank line at EOF.
```

This is not a runtime bug. It is a release hygiene issue because the previous plan explicitly required `git diff --check` to produce no output.

## Scope

Only fix:

- `docs/plans/2026-06-28-model-selector-config-fixes.md`

Optionally include this plan file if it exists as an uncommitted planning artifact:

- `docs/plans/2026-06-28-fix-plan-eof-whitespace.md`

Do not edit:

- `neloo-configurator/scripts/check-env.mjs`
- `neloo-configurator/scripts/check-env.test.mjs`
- `backend/src/agent/graph.py`
- `backend/src/model_ids.py`
- `backend/src/api/webapp.py`
- `frontend/src/lib/models.ts`
- README/configuration docs unrelated to the EOF whitespace defect

---

### Task 1: Reproduce the Whitespace Failure

**Files:**
- Read: `docs/plans/2026-06-28-model-selector-config-fixes.md`

**Step 1: Confirm current branch and cleanliness**

Run:

```bash
git status --short --branch
```

Expected before repair:

```text
## main...origin/main
```

If this plan file is already created but uncommitted, expected output may also include:

```text
?? docs/plans/2026-06-28-fix-plan-eof-whitespace.md
```

That is acceptable. Do not stage unrelated files.

**Step 2: Reproduce the exact failure**

Run:

```bash
git show --check --stat --oneline HEAD
```

Expected before repair:

```text
db269ff docs: add model configuration fix plan
docs/plans/2026-06-28-model-selector-config-fixes.md:672: new blank line at EOF.
```

**Step 3: Inspect the EOF area**

Run:

```bash
nl -ba docs/plans/2026-06-28-model-selector-config-fixes.md | tail -n 16
```

Expected before repair:

```text
   669 To https://github.com/Imd11/neloo
   670    <old>..<new>  main -> main
   671 ```
   672
```

The line numbers may shift if this plan has already been edited. The important signal is one blank line after the final fenced code block.

---

### Task 2: Remove the Extra EOF Blank Line

**Files:**
- Modify: `docs/plans/2026-06-28-model-selector-config-fixes.md:668-672`

**Step 1: Apply the minimal patch**

Use `apply_patch`. Remove only the final blank line after the closing code fence:

```patch
*** Begin Patch
*** Update File: docs/plans/2026-06-28-model-selector-config-fixes.md
@@
 To https://github.com/Imd11/neloo
    <old>..<new>  main -> main
 ```
-
*** End Patch
```

Do not reflow text. Do not rewrite the plan. Do not edit any business code.

**Step 2: Confirm the file has exactly one final newline**

Run:

```bash
node -e 'const fs=require("fs"); const p="docs/plans/2026-06-28-model-selector-config-fixes.md"; const s=fs.readFileSync(p,"utf8"); if (s.endsWith("\n\n")) throw new Error("extra blank line at EOF"); if (!s.endsWith("\n")) throw new Error("missing final newline"); console.log("single final newline ok")'
```

Expected:

```text
single final newline ok
```

**Step 3: Confirm only intended files are dirty**

Run:

```bash
git status --short
git diff -- docs/plans/2026-06-28-model-selector-config-fixes.md
```

Expected:

- `docs/plans/2026-06-28-model-selector-config-fixes.md` is modified.
- `docs/plans/2026-06-28-fix-plan-eof-whitespace.md` may be untracked if this plan has not been committed yet.
- No application code files are modified.

---

### Task 3: Run Focused Whitespace Verification

**Files:**
- No planned file changes.

**Step 1: Check the working tree diff**

Run:

```bash
git diff --check
```

Expected: no output and exit code `0`.

**Step 2: Check the final aggregate diff from the original model-config work base**

Run:

```bash
git diff --check f6aee2aa5bc41615edc417cd5c68b565c676c38f..HEAD -- docs/plans/2026-06-28-model-selector-config-fixes.md README.md backend/.env.example docs/configuration.md neloo-configurator/references/configuration-map.md neloo-configurator/scripts/check-env.mjs neloo-configurator/scripts/check-env.test.mjs
```

Expected before committing the fix: this may still report the committed EOF issue, because the fix is still in the working tree. Do not treat that as final failure before the commit.

**Step 3: Commit the repair**

Run:

```bash
git add docs/plans/2026-06-28-model-selector-config-fixes.md
git add docs/plans/2026-06-28-fix-plan-eof-whitespace.md 2>/dev/null || true
git commit -m "docs: fix plan whitespace"
```

Expected:

```text
[main <sha>] docs: fix plan whitespace
```

**Step 4: Re-run aggregate whitespace check after commit**

Run:

```bash
git diff --check f6aee2aa5bc41615edc417cd5c68b565c676c38f..HEAD
```

Expected: no output and exit code `0`.

**Step 5: Check the new commit itself**

Run:

```bash
git show --check --stat --oneline HEAD
```

Expected:

```text
<sha> docs: fix plan whitespace
```

No whitespace warnings should appear.

---

### Task 4: Re-run Regression Verification

**Files:**
- No planned file changes.

**Step 1: Run configurator tests**

Run:

```bash
node --test neloo-configurator/scripts/*.test.mjs
```

Expected:

```text
# fail 0
```

The current expected count is 14 tests, but the acceptance condition is zero failures.

**Step 2: Run Python syntax checks**

Run:

```bash
python3 -m py_compile backend/src/model_ids.py backend/src/agent/graph.py backend/src/api/webapp.py backend/src/storage/supabase_db.py
```

Expected: no output and exit code `0`.

**Step 3: Run model ID tests**

Run:

```bash
uv run --with pytest python -m pytest backend/tests/test_model_ids.py
```

Expected:

```text
4 passed
```

The existing unknown `asyncio_mode` pytest warning is acceptable if it remains a warning and does not become a failure.

**Step 4: Validate LangGraph JSON**

Run:

```bash
node -e 'const fs=require("fs"); JSON.parse(fs.readFileSync("backend/langgraph.json","utf8")); console.log("backend/langgraph.json ok")'
```

Expected:

```text
backend/langgraph.json ok
```

**Step 5: Run targeted frontend lint**

Run:

```bash
cd frontend && npm exec eslint src/lib/models.ts
```

Expected: no output and exit code `0`.

Do not use full `npm --prefix frontend run lint` as the acceptance gate for this repair. The known unrelated frontend lint issues are outside this plan.

**Step 6: Check conflict markers and high-confidence secret patterns**

Run:

```bash
rg -n "^(<<<<<<<|=======|>>>>>>>)" README.md backend/.env.example docs neloo-configurator/scripts neloo-configurator/references
rg -n --glob '!docs/plans/2026-06-28-fix-plan-eof-whitespace.md' "sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|SUPABASE_SERVICE_KEY=.*[A-Za-z0-9]{20,}|DATABASE_URL=postgresql://[^.]+|API_KEY=.*[A-Za-z0-9]{20,}" README.md backend/.env.example docs/configuration.md docs/plans neloo-configurator/references/configuration-map.md neloo-configurator/scripts/check-env.mjs neloo-configurator/scripts/check-env.test.mjs || true
```

Expected:

- Conflict marker command exits with no matches.
- Secret scan exits with no high-confidence matches.

---

### Task 5: Push and Confirm Remote Main

**Files:**
- No planned file changes.

**Step 1: Confirm local status before push**

Run:

```bash
git status --short --branch
git log --oneline origin/main..HEAD
```

Expected:

- Branch is `main`.
- Working tree is clean.
- One new commit appears: `docs: fix plan whitespace`.

**Step 2: Push to GitHub main**

Run:

```bash
git push origin main
```

Expected:

```text
To https://github.com/Imd11/neloo
   <old>..<new>  main -> main
```

**Step 3: Confirm remote points to local HEAD**

Run:

```bash
git status --short --branch
git ls-remote origin refs/heads/main
git rev-parse HEAD
```

Expected:

- `git status` shows `## main...origin/main` with no ahead/behind marker.
- `git ls-remote` SHA equals `git rev-parse HEAD`.

---

## Acceptance Criteria

- The trailing blank line at EOF is removed from `docs/plans/2026-06-28-model-selector-config-fixes.md`.
- `git diff --check f6aee2aa5bc41615edc417cd5c68b565c676c38f..HEAD` returns no output after the repair commit.
- `git show --check --stat --oneline HEAD` returns no whitespace warnings after the repair commit.
- No application code is changed.
- Configurator tests, model ID tests, Python compile checks, LangGraph JSON validation, and targeted frontend lint still pass.
- GitHub `origin/main` points to the new repair commit.

## Reviewer Notes

This is a narrow hygiene repair. If any verification failure appears outside Markdown whitespace, stop and report it instead of expanding scope. The likely fix is only one deleted blank line.
