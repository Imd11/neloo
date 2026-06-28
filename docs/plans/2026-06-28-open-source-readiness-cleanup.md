# Open Source Readiness Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Neloo coherent and safe for open-source users by ensuring the documented local setup actually runs, removing confusing legacy identity, tightening configuration diagnostics, and documenting production-only requirements.

**Architecture:** Keep the default repository path optimized for local development, with no hidden Postgres requirement. Move production persistence into an explicit config path, keep historical graph IDs such as `data_analyst` for compatibility, and make documentation/scripts describe the same configuration contract that the code enforces.

**Tech Stack:** Python 3.11, LangGraph, FastAPI, Next.js 16, Yarn 1, Node.js ESM scripts, Markdown documentation, GitHub repository settings.

---

## Constraints

- Do not rename runtime graph IDs such as `data_analyst`; they are compatibility identifiers.
- Do not commit real `.env`, `.env.local`, `.env.production`, `.vercel`, or platform secrets.
- Prefer local-minimal setup that can run without Supabase, Railway, E2B, or Postgres.
- Production persistence must be explicit and documented.
- Make small commits after each task.

---

### Task 1: Make Local LangGraph Startup Independent From `DATABASE_URL`

**Files:**
- Modify: `backend/langgraph.json`
- Create: `backend/langgraph.production.json`
- Modify: `Dockerfile`
- Modify: `backend/Dockerfile`
- Modify: `backend/start.py`
- Test: `backend/tests/test_langgraph_configs.py`

**Step 1: Write the config regression tests**

Create `backend/tests/test_langgraph_configs.py`:

```python
import json
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]


def load_config(name: str) -> dict:
    return json.loads((BACKEND_DIR / name).read_text())


def test_default_langgraph_config_has_no_postgres_requirement():
    config = load_config("langgraph.json")

    assert "checkpointer" not in config
    assert "store" not in config
    assert config["env"] == ".env"
    assert "data_analyst" in config["graphs"]


def test_production_langgraph_config_requires_database_url():
    config = load_config("langgraph.production.json")

    assert config["checkpointer"] == {
        "type": "postgres",
        "uri": "${DATABASE_URL}",
    }
    assert config["store"] == {
        "type": "postgres",
        "uri": "${DATABASE_URL}",
    }
    assert config["env"] == ".env"
    assert config["graphs"] == load_config("langgraph.json")["graphs"]
```

**Step 2: Run the new test and verify it fails**

Run:

```bash
cd <repo-root>/backend
python -m pytest tests/test_langgraph_configs.py -q
```

Expected: FAIL because `backend/langgraph.production.json` does not exist and `backend/langgraph.json` still contains `checkpointer` and `store`.

**Step 3: Create the production config**

Copy the current `backend/langgraph.json` into `backend/langgraph.production.json`.

Keep this block only in `backend/langgraph.production.json`:

```json
"checkpointer": {
  "type": "postgres",
  "uri": "${DATABASE_URL}"
},
"store": {
  "type": "postgres",
  "uri": "${DATABASE_URL}"
}
```

**Step 4: Remove hidden Postgres dependency from local default**

Edit `backend/langgraph.json` and remove only:

```json
"checkpointer": {
  "type": "postgres",
  "uri": "${DATABASE_URL}"
},
"store": {
  "type": "postgres",
  "uri": "${DATABASE_URL}"
}
```

Do not change graph names, graph paths, HTTP app config, Python version, or `env`.

**Step 5: Make container production persistence explicit without breaking both startup paths**

In root `Dockerfile`, replace the old product comment:

```text
Data Analyst Backend - Dockerfile
```

with:

```text
Neloo Backend - Dockerfile
```

Update the CMD to use the production config explicitly if the LangGraph CLI supports `--config`:

```dockerfile
CMD ["python", "-m", "langgraph_cli", "dev", "--config", "langgraph.production.json", "--no-reload", "--port", "8000", "--host", "0.0.0.0", "--allow-blocking"]
```

In `backend/Dockerfile`, update the comment to `Neloo Backend - Dockerfile`.

Do not force `backend/Dockerfile` through `langgraph.production.json` unless you also replace the `backend/start.py` startup path. `backend/start.py` currently creates a Postgres checkpointer when `DATABASE_URL` or Supabase DB values exist and safely falls back to in-memory storage when they do not. Preserve that fallback behavior.

In `backend/start.py`, replace user-visible old identity logs only:

```python
print("[START.PY] Starting Neloo Backend...", flush=True)
...
print(f"Starting Neloo Backend on port {port}")
```

Do not remove `data_analyst` graph IDs or route labels in `start.py`; those are compatibility identifiers.

**Step 6: Verify tests pass**

Run:

```bash
cd <repo-root>/backend
python -m pytest tests/test_langgraph_configs.py -q
```

Expected: PASS.

**Step 7: Verify JSON files parse**

Run:

```bash
cd <repo-root>
python -m json.tool backend/langgraph.json >/dev/null
python -m json.tool backend/langgraph.production.json >/dev/null
```

Expected: no output and exit code 0.

**Step 8: Smoke-test the local LangGraph config without `DATABASE_URL`**

Run:

```bash
cd <repo-root>/backend
env -u DATABASE_URL python -m json.tool langgraph.json >/dev/null
```

Then run a short startup smoke test:

```bash
cd <repo-root>/backend
env -u DATABASE_URL timeout 30s langgraph dev --host 127.0.0.1 --port 2034
```

Expected: the process starts without an immediate configuration error about `DATABASE_URL`. A timeout exit is acceptable because the dev server is long-running. If `timeout` is unavailable on macOS, start the command manually, wait until the server banner or API URL appears, then stop it with Ctrl-C.

**Step 9: Smoke-test Docker/Railway startup path**

If Docker is available, run:

```bash
cd <repo-root>
docker build -f Dockerfile -t neloo-backend-root-smoke .
```

Expected: image builds successfully and the command path can see `backend/langgraph.production.json` inside the copied backend directory.

Also inspect `backend/railway.toml` and confirm it still points at the root `Dockerfile`. If Railway should use `backend/Dockerfile` instead, update `backend/railway.toml` deliberately in this task and document why.

If Docker is not available locally, record the skipped smoke test in the final verification notes and do not claim Docker/Railway was verified.

**Step 10: Commit**

```bash
cd <repo-root>
git add backend/langgraph.json backend/langgraph.production.json backend/tests/test_langgraph_configs.py Dockerfile backend/Dockerfile backend/start.py backend/railway.toml
git commit -m "fix: make local langgraph config independent from database"
```

---

### Task 2: Align README And Configuration Docs With Local vs Production Persistence

**Files:**
- Modify: `README.md`
- Modify: `docs/readme/README.ar.md`
- Modify: `docs/readme/README.es.md`
- Modify: `docs/readme/README.id.md`
- Modify: `docs/readme/README.pt-BR.md`
- Modify: `docs/readme/README.zh-CN.md`
- Modify: `backend/README.md`
- Modify: `docs/configuration.md`
- Modify: `backend/.env.example`
- Modify: `neloo-configurator/references/configuration-map.md`

**Step 1: Update root README Quick Start**

In `README.md`, make the local-minimal backend section state:

```markdown
The default `backend/langgraph.json` is local-development oriented and does not require `DATABASE_URL`. Thread history may be ephemeral unless you configure production persistence.
```

Add a production persistence note:

```markdown
For Railway or another persistent deployment, use `backend/langgraph.production.json` and set `DATABASE_URL` to a Postgres connection string.
```

**Step 2: Update backend README**

In `backend/README.md`, add a subsection after Quick Start:

```markdown
## Local vs Production Persistence

`langgraph.json` is the default local development config and does not require `DATABASE_URL`.

`langgraph.production.json` enables Postgres-backed LangGraph checkpoints and store. Use it for Railway or other production deployments and set:

```env
DATABASE_URL=postgresql://...
```
```

**Step 3: Update docs/configuration.md**

In `docs/configuration.md`:

- Local Minimal Setup must explicitly say `DATABASE_URL` is not required.
- Production Setup must explicitly say `DATABASE_URL` is required when using `langgraph.production.json`.
- Database Persistence must distinguish:
  - local default: no hidden Postgres dependency
  - production persistent mode: `DATABASE_URL` required

**Step 4: Update backend/.env.example**

Near `DATABASE_URL=`, change the comments to:

```env
# Required only for production persistence with backend/langgraph.production.json.
# The default local backend/langgraph.json does not require this value.
DATABASE_URL=
```

**Step 5: Update configurator reference map**

In `neloo-configurator/references/configuration-map.md`, update the persistence section so:

- `DATABASE_URL` is "Required for production persistence"
- local-minimal profile treats missing `DATABASE_URL` as a warning only
- production profile treats missing `DATABASE_URL` as an error

**Step 6: Verify the docs no longer imply hidden local database requirement**

Update the translated README files so their Quick Start and Environment Configuration sections match the root README:

- `docs/readme/README.ar.md`
- `docs/readme/README.es.md`
- `docs/readme/README.id.md`
- `docs/readme/README.pt-BR.md`
- `docs/readme/README.zh-CN.md`

Each translation must communicate the same product facts:

- local minimal setup does not require `DATABASE_URL`
- production persistence requires `backend/langgraph.production.json` plus `DATABASE_URL`
- `data_analyst` is a historical assistant ID, not the product name
- frontend uses Yarn 1.x

**Step 7: Verify the docs no longer imply hidden local database requirement**

Run:

```bash
cd <repo-root>
grep -n "DATABASE_URL" README.md docs/readme/*.md backend/README.md docs/configuration.md backend/.env.example neloo-configurator/references/configuration-map.md
```

Expected: all `DATABASE_URL` mentions distinguish local default from production persistence.

**Step 8: Commit**

```bash
cd <repo-root>
git add README.md docs/readme/*.md backend/README.md docs/configuration.md backend/.env.example neloo-configurator/references/configuration-map.md
git commit -m "docs: clarify local and production database configuration"
```

---

### Task 3: Make `check-env.mjs` Profile-Aware For Database Requirements

**Files:**
- Modify: `neloo-configurator/scripts/check-env.mjs`
- Modify: `neloo-configurator/scripts/check-env.test.mjs`
- Modify: `neloo-configurator/SKILL.md`

**Step 1: Add failing tests for local and production database behavior**

In `neloo-configurator/scripts/check-env.test.mjs`, add:

```javascript
test("local profile warns but does not fail without DATABASE_URL", () => {
  const report = analyzeEnvironment({
    profile: "local-minimal",
    backend: {
      exists: true,
      values: {
        DEEPSEEK_API_KEY: "key",
        SANDBOX_MODE: "local",
      },
    },
    frontend: {
      exists: true,
      values: {
        NEXT_PUBLIC_API_URL: "http://localhost:2024",
      },
    },
  });

  assert.equal(report.ok, true);
  assert.equal(hasCode(report, "missing-production-database-url"), false);
  assert.equal(hasCode(report, "no-persistent-database"), true);
});

test("production profile fails without DATABASE_URL", () => {
  const report = analyzeEnvironment({
    profile: "production-railway-vercel",
    backend: {
      exists: true,
      values: {
        DEEPSEEK_API_KEY: "key",
        SANDBOX_MODE: "e2b",
        E2B_API_KEY: "e2b-key",
      },
    },
    frontend: {
      exists: true,
      values: {
        NEXT_PUBLIC_API_URL: "https://example.vercel.app",
      },
    },
  });

  assert.equal(report.ok, false);
  assert.equal(hasCode(report, "missing-production-database-url"), true);
});
```

**Step 2: Run tests and verify failure**

Run:

```bash
cd <repo-root>
node --test neloo-configurator/scripts/check-env.test.mjs
```

Expected: FAIL because `analyzeEnvironment` does not yet accept a profile-specific database requirement.

**Step 3: Implement profile handling**

In `neloo-configurator/scripts/check-env.mjs`:

- Change `analyzeEnvironment({ backend, frontend })` to `analyzeEnvironment({ backend, frontend, profile = "local-minimal" })`.
- Change CLI `parseArgs` default to:

```javascript
const args = { root: process.cwd(), json: false, profile: "local-minimal" };
```

- Parse:

```javascript
} else if (arg === "--profile") {
  args.profile = argv[++i] || args.profile;
}
```

- Pass profile through `checkRoot(root, profile)`.
- Add:

```javascript
const isProductionProfile = profile === "production-railway-vercel";
if (isProductionProfile && !hasValue(backendValues, "DATABASE_URL")) {
  add(report, "error", "missing-production-database-url", "DATABASE_URL is required for production persistence with backend/langgraph.production.json.", "backend/.env");
} else if (!hasValue(backendValues, "DATABASE_URL") && !hasValue(backendValues, "SUPABASE_DB_PASSWORD")) {
  add(report, "warning", "no-persistent-database", "No DATABASE_URL or SUPABASE_DB_PASSWORD found. Local development can run, but thread history may not persist after backend restarts.", "backend/.env");
}
```

Avoid duplicating the old `no-persistent-database` warning.

**Step 4: Document the new flag in the skill**

In `neloo-configurator/SKILL.md`, update examples:

```bash
node neloo-configurator/scripts/check-env.mjs --profile local-minimal
node neloo-configurator/scripts/check-env.mjs --profile production-railway-vercel
```

**Step 5: Run tests**

Run:

```bash
cd <repo-root>
node --test neloo-configurator/scripts/*.test.mjs
```

Expected: all tests pass.

**Step 6: Commit**

```bash
cd <repo-root>
git add neloo-configurator/scripts/check-env.mjs neloo-configurator/scripts/check-env.test.mjs neloo-configurator/SKILL.md
git commit -m "fix: make environment diagnostics profile aware"
```

---

### Task 4: Fix Public Frontend Provider Key Diagnostics

**Files:**
- Modify: `neloo-configurator/scripts/check-env.mjs`
- Modify: `neloo-configurator/scripts/check-env.test.mjs`
- Modify: `frontend/.env.example`
- Modify: `docs/configuration.md`

**Step 1: Add failing tests for public browser keys**

In `neloo-configurator/scripts/check-env.test.mjs`, add:

```javascript
test("allowed browser-side provider keys warn instead of fail", () => {
  const report = reportFor(
    { DEEPSEEK_API_KEY: "backend-key" },
    {
      NEXT_PUBLIC_DEEPSEEK_API_KEY: "browser-key",
      NEXT_PUBLIC_QWEN_API_KEY: "browser-qwen-key",
      NEXT_PUBLIC_TUZI_API_KEY: "browser-tuzi-key",
    }
  );

  assert.equal(report.ok, true);
  assert.equal(hasCode(report, "server-secret-in-frontend"), false);
  assert.equal(hasCode(report, "public-api-key"), true);
});

test("public-prefixed server-only secrets still fail", () => {
  const report = reportFor(
    { DEEPSEEK_API_KEY: "backend-key" },
    {
      NEXT_PUBLIC_SUPABASE_SERVICE_KEY: "service-secret",
    }
  );

  assert.equal(report.ok, false);
  assert.equal(hasCode(report, "server-secret-in-frontend"), true);
});
```

**Step 2: Run tests and verify failure**

Run:

```bash
cd <repo-root>
node --test neloo-configurator/scripts/check-env.test.mjs
```

Expected: FAIL because `NEXT_PUBLIC_DEEPSEEK_API_KEY` and `NEXT_PUBLIC_QWEN_API_KEY` are currently treated as server-secret errors.

**Step 3: Implement allowlist for intentional browser-side provider keys**

In `check-env.mjs`, add:

```javascript
const ALLOWED_PUBLIC_PROVIDER_KEYS = new Set([
  "NEXT_PUBLIC_TUZI_API_KEY",
  "NEXT_PUBLIC_TUZI_IMAGE_API_KEY",
  "NEXT_PUBLIC_DEEPSEEK_API_KEY",
  "NEXT_PUBLIC_QWEN_API_KEY",
]);
```

Update the server secret frontend check:

```javascript
for (const key of SERVER_ONLY_KEYS) {
  const publicKey = `NEXT_PUBLIC_${key}`;
  if (
    hasValue(frontendValues, key) ||
    (hasValue(frontendValues, publicKey) && !ALLOWED_PUBLIC_PROVIDER_KEYS.has(publicKey))
  ) {
    add(report, "error", "server-secret-in-frontend", `${key} is a server-side secret and must not be placed in frontend/.env.local.`, "frontend/.env.local");
  }
}
```

Keep the existing `public-api-key` warning for all public keys ending in `_API_KEY`.

**Step 4: Strengthen env example warning**

In `frontend/.env.example`, above the client-side provider keys, use:

```env
# WARNING: these keys are bundled into browser JavaScript.
# Use only local-development keys or tightly restricted provider keys.
# Production deployments should prefer backend proxy routes.
```

**Step 5: Strengthen docs warning**

In `docs/configuration.md`, add a short "Production recommendation" under image/slides/resume provider variables:

```markdown
For production, do not place unrestricted provider keys in `NEXT_PUBLIC_*`. Use restricted keys or move the provider call behind a server route.
```

**Step 6: Run tests**

Run:

```bash
cd <repo-root>
node --test neloo-configurator/scripts/*.test.mjs
```

Expected: all tests pass.

**Step 7: Commit**

```bash
cd <repo-root>
git add neloo-configurator/scripts/check-env.mjs neloo-configurator/scripts/check-env.test.mjs frontend/.env.example docs/configuration.md
git commit -m "fix: classify browser-exposed provider keys safely"
```

---

### Task 5: Standardize Frontend Package Manager On Yarn

**Files:**
- Delete: `frontend/package-lock.json`
- Modify: `README.md`
- Modify: `docs/readme/README.ar.md`
- Modify: `docs/readme/README.es.md`
- Modify: `docs/readme/README.id.md`
- Modify: `docs/readme/README.pt-BR.md`
- Modify: `docs/readme/README.zh-CN.md`
- Modify: `frontend/README.md`
- Modify: `frontend/.github/workflows/ci.yml`
- Modify: `neloo-configurator/references/configuration-map.md`

**Step 1: Remove the npm lockfile**

Delete:

```text
frontend/package-lock.json
```

Keep:

```text
frontend/yarn.lock
```

**Step 2: Update documentation and translations**

In `README.md`, `docs/readme/*.md`, `frontend/README.md`, and `neloo-configurator/references/configuration-map.md`, state:

```markdown
Use Yarn 1.x for the frontend. The repository ships `frontend/yarn.lock` as the canonical lockfile.
```

Do not present `npm install` as an equivalent default path.

**Step 3: Fix frontend CI install commands for Yarn 1**

In `frontend/.github/workflows/ci.yml`, replace every Yarn Berry install command:

```yaml
yarn install --immutable --mode=skip-build
```

with the Yarn 1-compatible command:

```yaml
yarn install --frozen-lockfile
```

Keep `corepack enable` and `actions/setup-node` cache settings unless they fail in CI. `package.json` already declares `packageManager: "yarn@1.22.22"`, so Corepack should activate Yarn 1.

**Step 4: Verify no package-lock remains and CI commands are Yarn 1-compatible**

Run:

```bash
cd <repo-root>
test ! -f frontend/package-lock.json
test -f frontend/yarn.lock
grep -n "Yarn 1" README.md docs/readme/*.md frontend/README.md neloo-configurator/references/configuration-map.md
grep -n -E -- "--immutable|--mode=skip-build" frontend/.github/workflows/ci.yml || true
grep -n -- "--frozen-lockfile" frontend/.github/workflows/ci.yml
```

Expected: no `package-lock.json`; `yarn.lock` exists; docs mention Yarn 1; CI no longer uses `--immutable` or `--mode=skip-build`; CI uses `--frozen-lockfile`.

**Step 5: Commit**

```bash
cd <repo-root>
git add README.md docs/readme/*.md frontend/README.md frontend/.github/workflows/ci.yml neloo-configurator/references/configuration-map.md
git rm frontend/package-lock.json
git commit -m "chore: standardize frontend package manager on yarn"
```

---

### Task 6: Finish Legacy Identity Cleanup In User-Visible Files

**Files:**
- Modify: `Dockerfile`
- Modify: `backend/Dockerfile`
- Modify: `backend/start.py`
- Modify: `ARCHITECTURE.md`
- Modify: `DEPLOY.md`
- Modify: `DATABASE_MIGRATION_GUIDE.md`
- Modify: `docs/configuration.md`
- Modify: `README.md`
- Modify: `docs/readme/README.ar.md`
- Modify: `docs/readme/README.es.md`
- Modify: `docs/readme/README.id.md`
- Modify: `docs/readme/README.pt-BR.md`
- Modify: `docs/readme/README.zh-CN.md`

**Step 1: Scan user-visible files for stale identity**

Run:

```bash
cd <repo-root>
grep -R -n -E "Data Analyst Agent|Deepagents UI|deep-agents-ui|apps/data-analyst" \
  README.md backend/README.md frontend/README.md ARCHITECTURE.md DEPLOY.md DATABASE_MIGRATION_GUIDE.md Dockerfile backend/Dockerfile backend/start.py docs || true
```

Expected before changes: matches in old root docs or comments may remain.

**Step 2: Update Dockerfile comments**

Replace stale product comments with:

```text
Neloo Backend - Dockerfile
```

Do not change Docker build behavior except the production config change from Task 1.

**Step 3: Update current docs**

For docs that are still current, replace old identity language:

- "Data Analyst Agent" -> "Neloo"
- "data analysis agent" -> "general-purpose AI agent workspace" when describing product scope
- keep `data_analyst` only when explicitly referring to the historical graph ID

Also update translated READMEs under `docs/readme/` so non-English users do not see stale product identity after the English README has been fixed.

**Step 4: Update backend/start.py logs**

In `backend/start.py`, replace user-facing startup text:

- `Starting Data Analyst Backend...` -> `Starting Neloo Backend...`
- `Starting Data Analyst Agent on port ...` -> `Starting Neloo Backend on port ...`

Do not rename the `"data_analyst"` graph in `GraphConfig`, printed graph labels that refer to compatibility routes, or environment variables. If a log mentions `data_analyst`, add a short compatibility note only if it is user-facing and confusing.

**Step 5: Add compatibility note once, not everywhere**

In `README.md` or `docs/configuration.md`, keep one clear note:

```markdown
The default assistant ID is still `data_analyst` for compatibility with existing graph IDs and stored threads. It is not the product name.
```

**Step 6: Verify scan**

Run:

```bash
cd <repo-root>
grep -R -n -E "Data Analyst Agent|Deepagents UI|deep-agents-ui|apps/data-analyst" \
  README.md backend/README.md frontend/README.md ARCHITECTURE.md DEPLOY.md DATABASE_MIGRATION_GUIDE.md Dockerfile backend/Dockerfile backend/start.py docs || true
```

Expected: no stale product identity matches. `data_analyst` may remain only in configuration contexts.

**Step 7: Commit**

```bash
cd <repo-root>
git add README.md docs/readme/*.md ARCHITECTURE.md DEPLOY.md DATABASE_MIGRATION_GUIDE.md Dockerfile backend/Dockerfile backend/start.py docs/configuration.md
git commit -m "docs: finish neloo identity cleanup"
```

---

### Task 7: Classify Or Archive Legacy Root Documents

**Files:**
- Create: `docs/legacy/README.md`
- Move or Modify:
  - `COMMIT_MECHANISM_EXPLAINED.md`
  - `MIGRATION_REPORT.md`
  - `THREAD_ID_DIAGRAM.md`
  - `THREAD_ID_EXPLANATION.md`
  - `UPLOAD_FLOW_DIAGRAM.md`
  - `UPLOAD_SESSIONS_EXPLAINED.md`
  - `supabase_fix_upload_sessions.sql`
  - `supabase_fix_upload_sessions_v2.sql`
- Modify: `README.md`

**Step 1: Create legacy index**

Create `docs/legacy/README.md`:

```markdown
# Legacy Notes

These files are historical implementation notes kept for maintainers. They are not required for a new Neloo installation.

Current setup documentation lives in:

- `README.md`
- `docs/configuration.md`
- `backend/README.md`
- `frontend/README.md`
```

**Step 2: Move historical notes**

Move historical notes that are not required for first-run setup into `docs/legacy/`.

Use `git mv`, for example:

```bash
git mv COMMIT_MECHANISM_EXPLAINED.md docs/legacy/COMMIT_MECHANISM_EXPLAINED.md
git mv MIGRATION_REPORT.md docs/legacy/MIGRATION_REPORT.md
git mv THREAD_ID_DIAGRAM.md docs/legacy/THREAD_ID_DIAGRAM.md
git mv THREAD_ID_EXPLANATION.md docs/legacy/THREAD_ID_EXPLANATION.md
git mv UPLOAD_FLOW_DIAGRAM.md docs/legacy/UPLOAD_FLOW_DIAGRAM.md
git mv UPLOAD_SESSIONS_EXPLAINED.md docs/legacy/UPLOAD_SESSIONS_EXPLAINED.md
git mv supabase_fix_upload_sessions.sql docs/legacy/supabase_fix_upload_sessions.sql
git mv supabase_fix_upload_sessions_v2.sql docs/legacy/supabase_fix_upload_sessions_v2.sql
```

Only keep root-level docs that are useful to a new user.

**Step 3: Update README documentation links**

In `README.md`, link only current docs in the main documentation section:

- `docs/configuration.md`
- `backend/README.md`
- `frontend/README.md`
- `docs/legacy/README.md` as historical notes

**Step 4: Verify root document clarity**

Run:

```bash
cd <repo-root>
ls -1 *.md
ls -1 docs/legacy
```

Expected: root contains only current, high-signal docs; historical notes are under `docs/legacy`.

**Step 5: Commit**

```bash
cd <repo-root>
git add README.md docs/legacy
git add -u
git commit -m "docs: archive legacy implementation notes"
```

---

### Task 8: Run And Document Secret / Private Information Audit

**Files:**
- Create: `docs/open-source-secret-audit.md`
- Modify: `.gitignore` only if gaps are found

**Step 1: Verify sensitive local files are ignored**

Run:

```bash
cd <repo-root>
git status --short --ignored .env.local backend/.env backend/.env.production frontend/.env.local .vercel frontend/.vercel
```

Expected: sensitive local files show as ignored or untracked-but-not-staged, never tracked.

**Step 2: Verify tracked files do not include env files**

Run:

```bash
cd <repo-root>
git ls-files | grep -E '(^|/)\.env($|\.local|\.production)|(^|/)\.vercel(/|$)' || true
```

Expected: no output.

**Step 3: Scan tracked text for high-confidence secret patterns**

Run:

```bash
cd <repo-root>
git grep -n -E 'sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|postgresql://[^[:space:]]+:[^[:space:]@]+@|SUPABASE_SERVICE_KEY=.+[A-Za-z0-9]{20,}|DATABASE_URL=postgresql://[^.]' -- . ':!docs/plans' || true
```

Expected: no real secrets. Placeholder examples are acceptable only when obviously fake.

**Step 4: Scan for personal paths and local project identifiers**

Run:

```bash
cd <repo-root>
git grep -n -E '<home>|/var/folders|Imd11|neloo-zeta|selfless-fulfillment' -- README.md docs backend frontend Dockerfile vercel.json || true
```

Expected: no private local paths. Public repository owner or deployment URLs are acceptable only if intentionally kept.

**Step 5: Write audit report**

Create `docs/open-source-secret-audit.md`:

```markdown
# Open Source Secret Audit

Date: 2026-06-28

## Scope

- Tracked source files
- README and documentation
- Environment templates
- Deployment config templates

## Results

- No tracked `.env` or `.vercel` files.
- No high-confidence provider secrets found in tracked files.
- Placeholder values remain only in `.env.example` and documentation.

## Required Maintainer Actions

- Rotate any key that was ever committed before this audit.
- Keep real secrets in local `.env` files, Railway, Vercel, Supabase, E2B, or provider dashboards.
- Do not paste real secrets into issues, discussions, or README examples.
```

Update the result bullets according to actual findings.

**Step 6: Commit**

```bash
cd <repo-root>
git add docs/open-source-secret-audit.md .gitignore
git commit -m "docs: add open source secret audit"
```

---

### Task 9: Improve Configurator New-User Entry Points

**Files:**
- Modify: `README.md`
- Modify: `neloo-configurator/SKILL.md`
- Modify: `.agents/skills/neloo-configurator/SKILL.md`
- Modify: `.claude/skills/neloo-configurator/SKILL.md`
- Modify: `neloo-configurator/scripts/setup-env.mjs`
- Modify: `neloo-configurator/scripts/setup-env.test.mjs`

**Step 1: Add non-AI CLI usage to README**

In `README.md`, under Environment Configuration, add:

```markdown
Without an AI coding tool, run:

```bash
node neloo-configurator/scripts/setup-env.mjs --profile local-minimal
node neloo-configurator/scripts/check-env.mjs --profile local-minimal
```

With Codex/Copilot/Cursor-style tools, use `.agents/skills/neloo-configurator/`.
With Claude Code, use `.claude/skills/neloo-configurator/`.
```

**Step 2: Add clearer script output**

In `setup-env.mjs`, update the final messages to include:

```text
Next steps:
1. Add one backend chat model key in backend/.env.
2. Run node neloo-configurator/scripts/check-env.mjs --profile <profile>.
3. Start backend and frontend only after errors are resolved.
```

**Step 3: Add test for next-step output**

In `setup-env.test.mjs`, add:

```javascript
test("setupEnvironment prints concrete next steps", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "neloo-config-test-"));
  fs.mkdirSync(path.join(root, "backend"), { recursive: true });
  fs.mkdirSync(path.join(root, "frontend"), { recursive: true });
  fs.writeFileSync(path.join(root, "backend/.env.example"), "PORT=\n");
  fs.writeFileSync(path.join(root, "frontend/.env.example"), "NEXT_PUBLIC_API_URL=\n");

  const result = setupEnvironment({ root, profile: "local-minimal", dryRun: true });
  const output = result.messages.join("\n");

  assert.match(output, /Next steps:/);
  assert.match(output, /check-env\.mjs --profile local-minimal/);
});
```

**Step 4: Run tests**

Run:

```bash
cd <repo-root>
node --test neloo-configurator/scripts/*.test.mjs
```

Expected: all tests pass.

**Step 5: Commit**

```bash
cd <repo-root>
git add README.md neloo-configurator/SKILL.md .agents/skills/neloo-configurator/SKILL.md .claude/skills/neloo-configurator/SKILL.md neloo-configurator/scripts/setup-env.mjs neloo-configurator/scripts/setup-env.test.mjs
git commit -m "docs: clarify configurator setup entry points"
```

---

### Task 10: Update GitHub Repository Metadata

**Files:**
- No repository file changes required unless adding a checklist note to `README.md`

**Step 1: Update GitHub About**

In GitHub repository settings, set:

```text
Neloo is a general-purpose AI agent workspace built with LangGraph, Deep Agents, Next.js, Supabase, Railway, and E2B.
```

**Step 2: Update website**

Set the website field to the current public deployment URL if it is intended for users. Otherwise leave it blank until the deployment is stable.

**Step 3: Update topics**

Suggested topics:

```text
ai-agent
langgraph
deep-agents
nextjs
supabase
railway
e2b
llm
agent-workspace
```

**Step 4: Verify GitHub page**

Open the repository homepage and confirm:

- About no longer says "Data Analyst Agent".
- README title and About description both say Neloo.
- License badge/section is visible.
- Website URL points to the intended deployment.

**Step 5: No commit**

This task changes GitHub metadata only. There is no local commit unless README gets an additional repository metadata note.

---

### Task 11: Final Verification Pass

**Files:**
- No intended source changes.

**Step 1: Run backend focused tests**

Run:

```bash
cd <repo-root>/backend
python -m py_compile src/model_ids.py src/agent/graph.py src/api/webapp.py src/storage/supabase_db.py
python -m pytest tests/test_model_ids.py tests/test_langgraph_configs.py -q
```

Expected: all selected tests pass.

**Step 2: Run configurator tests**

Run:

```bash
cd <repo-root>
node --test neloo-configurator/scripts/*.test.mjs
```

Expected: all tests pass.

**Step 3: Run frontend metadata and lint checks**

Run:

```bash
cd <repo-root>/frontend
yarn lint
```

Expected: lint passes or only pre-existing unrelated warnings are documented.

**Step 4: Run frontend CI install command check**

Run:

```bash
cd <repo-root>
grep -n -E -- "--immutable|--mode=skip-build" frontend/.github/workflows/ci.yml || true
grep -n -- "--frozen-lockfile" frontend/.github/workflows/ci.yml
test ! -f frontend/package-lock.json
test -f frontend/yarn.lock
```

Expected: no Yarn Berry install flags remain; CI uses `--frozen-lockfile`; only `frontend/yarn.lock` exists.

**Step 5: Run Docker/Railway startup-path smoke check**

If Docker is available:

```bash
cd <repo-root>
docker build -f Dockerfile -t neloo-backend-root-smoke .
```

Expected: build succeeds. If skipped, explicitly report that Docker/Railway startup was not verified locally.

Also verify Railway still references the intended Dockerfile:

```bash
cd <repo-root>
grep -n "dockerfilePath" backend/railway.toml
```

Expected: path matches the Dockerfile actually used for production deployment.

**Step 6: Run open-source readiness scans**

Run:

```bash
cd <repo-root>
grep -R -n -E "Data Analyst Agent|Deepagents UI|deep-agents-ui|apps/data-analyst" \
  README.md backend/README.md frontend/README.md ARCHITECTURE.md DEPLOY.md DATABASE_MIGRATION_GUIDE.md Dockerfile backend/Dockerfile backend/start.py docs || true

git ls-files | grep -E '(^|/)\.env($|\.local|\.production)|(^|/)\.vercel(/|$)' || true

git diff --check
```

Expected:

- no stale product identity matches
- no tracked local env or Vercel files
- no whitespace errors

**Step 7: Review git diff**

Run:

```bash
cd <repo-root>
git status --short
git diff --stat
git diff -- README.md docs/readme docs/configuration.md backend/langgraph.json backend/langgraph.production.json backend/start.py frontend/.github/workflows/ci.yml neloo-configurator/scripts/check-env.mjs
```

Expected: only planned files changed.

**Step 8: Commit final fixes if needed**

If final verification required small corrections:

```bash
cd <repo-root>
git add <corrected-files>
git commit -m "chore: finalize open source readiness cleanup"
```

**Step 9: Push after user approval**

Only after the user explicitly asks to push:

```bash
cd <repo-root>
git push origin main
```

---

## Acceptance Criteria

- A new user can follow the root README local path without configuring `DATABASE_URL`.
- Production persistence is still documented and available through `backend/langgraph.production.json`.
- `backend/start.py` keeps its safe in-memory fallback and no longer exposes stale "Data Analyst" product logs.
- `check-env.mjs --profile local-minimal` does not fail only because database persistence is absent.
- `check-env.mjs --profile production-railway-vercel` fails when `DATABASE_URL` is missing.
- Browser-exposed provider keys generate warnings, not contradictory errors.
- Server-only secrets still fail if placed in frontend env files.
- Frontend package manager guidance is Yarn-only, `frontend/package-lock.json` is removed, and frontend CI uses Yarn 1-compatible install flags.
- User-visible docs no longer describe the product as "Data Analyst Agent" or "Deepagents UI".
- Translated README files under `docs/readme/` match the same local/production setup contract as the root README.
- Historical notes are either current, archived under `docs/legacy/`, or removed.
- Secret audit report exists and confirms no tracked private config.
- Docker/Railway startup path is either smoke-tested locally or explicitly reported as not locally verified.
- GitHub About metadata is updated to Neloo.
