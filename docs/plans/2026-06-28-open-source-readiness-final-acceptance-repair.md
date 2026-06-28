# Open Source Readiness Final Acceptance Repair Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining acceptance gaps before treating the open-source readiness work as complete.

**Architecture:** Keep the existing open-source cleanup and model/configuration changes intact. Make only narrow documentation consistency fixes, then run a full verification pass that proves local startup, configurator behavior, Docker path configuration, frontend build behavior, and open-source safety scans are in the expected state.

**Tech Stack:** Markdown documentation, Node.js ESM tests, Python pytest, LangGraph CLI, Next.js/Yarn 1, GitHub Actions YAML, Dockerfile smoke checks.

---

## Constraints

- Do not rewrite the existing open-source readiness implementation.
- Do not rename compatibility IDs or historical runtime identifiers such as `data_analyst`.
- Do not rename `e2b-template/data-analyst-sandbox/` unless every E2B reference is migrated in a separate dedicated plan.
- Do not commit `.env`, `.env.local`, `.vercel`, generated build output, or `backend/uv.lock`.
- Keep fixes reviewable and commit after each coherent task.
- Use `karpathy-guidelines` during implementation.
- Use `verification-before-completion` before reporting completion.
- Push to GitHub only after the user explicitly asks for execution and push.

---

### Task 1: Sync The E2B Historical-Name Explanation Across Translated README Files

**Files:**
- Modify: `docs/readme/README.zh-CN.md`
- Check: `README.md`
- Check: `docs/readme/README.es.md`
- Check: `docs/readme/README.ar.md`
- Check: `docs/readme/README.id.md`
- Check: `docs/readme/README.pt-BR.md`

**Problem:**

The root README explains that `e2b-template/data-analyst-sandbox/` keeps its historical name for E2B compatibility. The Chinese README still mentions the path without explaining why a general-agent project contains a `data-analyst-sandbox` directory. That can confuse new users during open-source review.

**Step 1: Write the failing documentation check**

Run:

```bash
cd <repo-root>
rg -n "data-analyst-sandbox" README.md docs/readme
```

Expected before the fix:

- `README.md` includes both `data-analyst-sandbox` and a compatibility explanation.
- `docs/readme/README.zh-CN.md` includes `data-analyst-sandbox` without the same explanation.

**Step 2: Patch the Chinese README**

Add one sentence immediately after the Chinese E2B template path sentence:

```markdown
该目录暂时保留历史名称 `data-analyst-sandbox`，用于兼容现有 E2B 模板配置。
```

Do not translate or rename the actual directory path.

**Step 3: Verify the explanation exists**

Run:

```bash
cd <repo-root>
rg -n "data-analyst-sandbox|历史名称|compatibility" README.md docs/readme/README.zh-CN.md
```

Expected:

- Root README still contains the English compatibility note.
- Chinese README now contains the Chinese compatibility note.

**Step 4: Commit**

```bash
cd <repo-root>
git add docs/readme/README.zh-CN.md
git commit -m "docs: sync e2b legacy naming note"
```

---

### Task 2: Re-Run Backend Verification And Local Startup Without `DATABASE_URL`

**Files:**
- Check: `backend/langgraph.json`
- Check: `backend/langgraph.production.json`
- Check: `backend/tests/test_langgraph_configs.py`
- Check: `backend/tests/test_dockerfiles.py`
- Check: `backend/tests/test_model_ids.py`

**Problem:**

The main risk for new users is still whether the documented local path really starts without `DATABASE_URL`. This must be verified from the current code, not inferred from documentation.

**Step 1: Run JSON and backend tests**

Run:

```bash
cd <repo-root>/backend
python3 -m json.tool langgraph.json >/dev/null
python3 -m json.tool langgraph.production.json >/dev/null
python3 -m compileall -q src tests
uv run --with pytest python -m pytest tests/test_model_ids.py tests/test_langgraph_configs.py tests/test_dockerfiles.py -q
rm -f uv.lock
```

Expected:

- JSON checks pass.
- Compile check passes.
- Selected tests pass.
- `backend/uv.lock` is removed if `uv` created it.

**Step 2: Smoke-test local LangGraph startup without `DATABASE_URL`**

Run:

```bash
cd <repo-root>/backend
env -u DATABASE_URL timeout 35s ./.venv/bin/python -m langgraph_cli dev --host 127.0.0.1 --port 2035 --no-browser --allow-blocking
```

Expected:

- The command starts the LangGraph server and then exits with timeout code `124`.
- There is no failure that says `DATABASE_URL` is required.
- If `.venv` is missing, use the project-supported Python environment and record that substitution in the final report.

**Step 3: Fix only if verification fails**

If startup fails because `DATABASE_URL` is required by the default local config, make the smallest correction so `backend/langgraph.json` remains local-development oriented and `backend/langgraph.production.json` remains the Postgres-backed production config.

Add or update a regression test in `backend/tests/test_langgraph_configs.py` that proves:

```python
def test_local_langgraph_config_does_not_require_database_url():
    config = json.loads((BACKEND_DIR / "langgraph.json").read_text())

    assert "DATABASE_URL" not in json.dumps(config)
```

Then re-run Step 1 and Step 2.

**Step 4: Commit if a code or test fix was needed**

```bash
cd <repo-root>
git add backend/langgraph.json backend/langgraph.production.json backend/tests/test_langgraph_configs.py
git commit -m "fix: keep local langgraph config database optional"
```

Skip this commit if verification already passes without changes.

---

### Task 3: Verify Configurator Behavior Matches The User Setup Flow

**Files:**
- Check: `neloo-configurator/scripts/setup-env.mjs`
- Check: `neloo-configurator/scripts/setup-env.test.mjs`
- Check: `neloo-configurator/scripts/check-env.mjs`
- Check: `neloo-configurator/scripts/check-env.test.mjs`
- Check: `neloo-configurator/references/configuration-map.md`

**Problem:**

The setup assistant must make sense to a new user: generate local or production env files, then tell the user to fill provider keys, run `check-env`, and only then start backend/frontend.

**Step 1: Run configurator tests**

Run:

```bash
cd <repo-root>
node --test neloo-configurator/scripts/*.test.mjs
```

Expected:

- All configurator tests pass.
- Local setup output contains `Next steps:`.
- Production setup output mentions Railway/Vercel dashboards and does not print local `langgraph dev` startup commands.

**Step 2: Manually inspect dry-run output**

Run:

```bash
cd <repo-root>
node neloo-configurator/scripts/setup-env.mjs --profile local-minimal --dry-run
node neloo-configurator/scripts/setup-env.mjs --profile production-railway-vercel --dry-run
```

Expected:

- Local output tells the user to fill at least one backend chat model key.
- Local output tells the user to run `node neloo-configurator/scripts/check-env.mjs --profile local-minimal`.
- Production output names `DATABASE_URL`, `E2B_API_KEY`, provider keys, Railway, and Vercel.

**Step 3: Fix only if output is confusing or mismatched**

If output does not match the expected flow, update `neloo-configurator/scripts/setup-env.mjs` and its tests together. Keep the wording concise and do not add an interactive wizard in this plan.

**Step 4: Commit if a fix was needed**

```bash
cd <repo-root>
git add neloo-configurator/scripts/setup-env.mjs neloo-configurator/scripts/setup-env.test.mjs
git commit -m "fix: clarify configurator setup flow"
```

Skip this commit if verification already passes without changes.

---

### Task 4: Verify Frontend CI State Is Honest And Non-Blocking For Existing Lint Debt

**Files:**
- Check: `frontend/.github/workflows/ci.yml`
- Check: `docs/frontend-lint-notes.md`
- Check: `frontend/package.json`
- Check: `frontend/yarn.lock`

**Problem:**

The repository currently has broad pre-existing frontend lint debt. The open-source readiness work should not pretend lint is clean, but CI should still expose lint output and avoid blocking unrelated open-source setup.

**Step 1: Verify lockfile and workflow state**

Run:

```bash
cd <repo-root>
test ! -f frontend/package-lock.json
test -f frontend/yarn.lock
! grep -q -E -- "--immutable|--mode=skip-build" frontend/.github/workflows/ci.yml
grep -n -- "--frozen-lockfile" frontend/.github/workflows/ci.yml
grep -n "continue-on-error: true" frontend/.github/workflows/ci.yml
test -f docs/frontend-lint-notes.md
```

Expected:

- No frontend `package-lock.json`.
- `frontend/yarn.lock` exists.
- CI uses Yarn 1 `--frozen-lockfile`.
- Lint job has `continue-on-error: true`.
- `docs/frontend-lint-notes.md` exists.

**Step 2: Run frontend build**

Run:

```bash
cd <repo-root>/frontend
yarn build
```

Expected:

- Build passes.
- Existing framework warnings are acceptable if they do not fail the build.

**Step 3: Capture lint debt without treating it as a surprise**

Run:

```bash
cd <repo-root>/frontend
yarn lint > /tmp/neloo-frontend-lint-final.txt 2>&1 || true
tail -n 12 /tmp/neloo-frontend-lint-final.txt
```

Expected:

- Lint may still report the documented existing debt.
- Final report must say lint is intentionally visible but currently non-blocking.
- Do not do a broad lint cleanup in this plan.

**Step 4: Fix only if CI/documentation is misleading**

If lint is blocking CI or `docs/frontend-lint-notes.md` is missing, restore the documented non-blocking lint state. Do not touch unrelated frontend UI code.

**Step 5: Commit if a fix was needed**

```bash
cd <repo-root>
git add frontend/.github/workflows/ci.yml docs/frontend-lint-notes.md
git commit -m "ci: document frontend lint debt"
```

Skip this commit if verification already passes without changes.

---

### Task 5: Run Open-Source Safety Scans Before Acceptance

**Files:**
- Check: entire tracked repository
- Exclude from interpretation: `docs/plans/*` where historical problem statements may mention old names
- Exclude from secret false positives: lockfiles and explicit audit docs

**Problem:**

Before open-sourcing, the repository needs one final safety pass for stale product identity, local personal paths, tracked env files, and hardcoded secrets.

**Step 1: Scan for stale public identity**

Run:

```bash
cd <repo-root>
grep -R -n -E "Data Analyst Agent|Deepagents UI|deep-agents-ui|apps/data-analyst|data-analyst-agent|data-analyst-frontend" \
  README.md backend/README.md frontend/README.md ARCHITECTURE.md DEPLOY.md DATABASE_MIGRATION_GUIDE.md Dockerfile backend/Dockerfile backend/start.py docs \
  --exclude-dir=plans || true
```

Expected:

- No matches in public docs or deployment-facing files.
- Runtime compatibility names such as `data_analyst` are allowed only where documented as historical graph IDs.

**Step 2: Scan for personal local paths or emails**

Run:

```bash
cd <repo-root>
git grep -n -I -E '/Users/[^/]+|/home/[^/]+|[A-Za-z0-9._%+-]+@' -- . ':!docs/plans/*' ':!docs/open-source-secret-audit.md' || true
```

Expected:

- No personal machine paths.
- Any email-like matches must be examples, package metadata, or documentation placeholders; otherwise remove or replace them.

**Step 3: Scan for likely hardcoded secrets**

Run:

```bash
cd <repo-root>
git grep -n -I -E 'sk-[A-Za-z0-9_-]{20,}|e2b_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|postgres(ql)?://[^[:space:]]+:[^[:space:]]+@|mongodb(\+srv)?://[^[:space:]]+:[^[:space:]]+@|mysql://[^[:space:]]+:[^[:space:]]+@|redis://[^[:space:]]+:[^[:space:]]+@' -- . ':!frontend/yarn.lock' ':!docs/open-source-secret-audit.md' ':!docs/plans/*' || true
```

Expected:

- No real provider keys or credentialed URLs.
- Dynamic string construction in code can be recorded as a false positive only after inspection.

**Step 4: Confirm no env files are tracked**

Run:

```bash
cd <repo-root>
git ls-files | grep -E '(^|/)\.env($|\.local|\.production)|(^|/)\.vercel(/|$)' || true
```

Expected:

- No output.

**Step 5: Check whitespace**

Run:

```bash
cd <repo-root>
git diff --check
```

Expected:

- No whitespace errors.

**Step 6: Fix any true positive**

For a true positive:

- Replace personal paths with relative project paths.
- Replace real secrets with placeholders.
- Move private configuration into `.env.example` placeholders only.
- Add or update documentation so the user knows where to put their own value.

**Step 7: Commit if a fix was needed**

```bash
cd <repo-root>
git add <changed-files>
git commit -m "chore: remove open source readiness residue"
```

Skip this commit if scans are clean.

---

### Task 6: Verify Docker Deployment Paths As Far As The Local Machine Allows

**Files:**
- Check: `Dockerfile`
- Check: `backend/Dockerfile`
- Check: `backend/railway.toml`
- Check: `DEPLOY.md`
- Check: `README.md`

**Problem:**

Documentation says users can deploy with either the root Dockerfile or `backend/Dockerfile`. The repository must either support both or clearly remove one path from the docs.

**Step 1: Verify Railway backend path points to a real Dockerfile**

Run:

```bash
cd <repo-root>
grep -n "dockerfilePath" backend/railway.toml
test -f backend/Dockerfile
test -f Dockerfile
```

Expected:

- `backend/railway.toml` points to `Dockerfile` relative to the backend service root.
- Both Dockerfiles exist.

**Step 2: Try Docker builds if Docker is available**

Run:

```bash
cd <repo-root>
if docker info >/dev/null 2>&1; then
  docker build -f backend/Dockerfile -t neloo-backend-subdir-smoke backend
  docker build -f Dockerfile -t neloo-backend-root-smoke .
else
  echo "docker unavailable"
fi
```

Expected:

- If Docker is available, both builds pass.
- If Docker is unavailable, final acceptance must explicitly say Docker build was not locally verified.

**Step 3: Fix only if a supported path is broken**

If a Docker path fails because of repository layout, fix the Dockerfile. If a path is not intended to be supported, remove that path from `README.md` and `DEPLOY.md`. Prefer making the documented path work.

**Step 4: Commit if a fix was needed**

```bash
cd <repo-root>
git add Dockerfile backend/Dockerfile backend/railway.toml README.md DEPLOY.md backend/tests/test_dockerfiles.py
git commit -m "fix: align docker deployment paths"
```

Skip this commit if verification already passes or Docker is unavailable without evidence of a file issue.

---

### Task 7: Final Acceptance Report And GitHub Push Gate

**Files:**
- Check: Git state
- Optional Check: GitHub repository metadata

**Problem:**

The user needs a clear final answer from a new-user perspective, and the branch should only be pushed after the requested verification has completed.

**Step 1: Review git state**

Run:

```bash
cd <repo-root>
git status --short --branch
git log --oneline --decorate -8
```

Expected:

- Only intentional commits are ahead of `origin/main`.
- No untracked env files or generated artifacts.

**Step 2: If push is requested, push main**

Run only after the user asks to execute and push:

```bash
cd <repo-root>
git push origin main
```

Expected:

- Push succeeds.

**Step 3: Confirm local and remote heads match**

Run:

```bash
cd <repo-root>
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

Expected:

- Branch is not ahead after push.
- `HEAD` equals `origin/main`.

**Step 4: Final user-facing report**

Report in Chinese:

- What a new user now sees in the repository.
- Which setup path they should follow.
- Which integrations are optional vs required.
- Which checks passed.
- Any honest residual risk, especially Docker daemon unavailable or frontend lint debt intentionally documented as non-blocking.

