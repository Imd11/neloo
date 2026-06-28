# Docker Railway Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Neloo's Docker and Railway deployment paths safe and verifiable before open source release.

**Architecture:** Add a lightweight static release-readiness checker for Docker/Railway-specific invariants, then fix the two concrete risks it exposes: missing Docker ignore rules and root Dockerfile port handling. Keep the existing two deployment paths intact: repository-root `Dockerfile` for Railway root deployments and `backend/Dockerfile` for Railway `backend/` root deployments.

**Tech Stack:** Docker, Railway, Python 3.11, LangGraph CLI, Node.js `node:test`, GitHub Actions.

---

### Task 1: Add A Failing Docker/Railway Readiness Test

**Files:**
- Create: `scripts/check-docker-release-readiness.test.mjs`
- Read: `Dockerfile`
- Read: `backend/Dockerfile`
- Read: `backend/start.py`

**Step 1: Write the failing test**

Create `scripts/check-docker-release-readiness.test.mjs` with tests that shell out to the checker:

```js
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const checker = path.join(repoRoot, "scripts/check-docker-release-readiness.mjs");

test("docker release readiness checker passes for the repository", () => {
  const result = spawnSync(process.execPath, [checker], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(
    result.status,
    0,
    `Expected checker to pass.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
  );
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test scripts/check-docker-release-readiness.test.mjs
```

Expected: FAIL because `scripts/check-docker-release-readiness.mjs` does not exist yet.

**Step 3: Commit**

Do not commit yet. This task intentionally creates a failing test and will be committed with the implementation in Task 2.

---

### Task 2: Implement The Docker/Railway Static Checker

**Files:**
- Create: `scripts/check-docker-release-readiness.mjs`
- Test: `scripts/check-docker-release-readiness.test.mjs`

**Step 1: Implement the checker**

Create `scripts/check-docker-release-readiness.mjs`:

```js
#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

const failures = [];

function read(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireIncludes(file, content, snippets) {
  for (const snippet of snippets) {
    if (!content.includes(snippet)) {
      failures.push(`${file} must include: ${snippet}`);
    }
  }
}

function requireNotIncludes(file, content, snippets) {
  for (const snippet of snippets) {
    if (content.includes(snippet)) {
      failures.push(`${file} must not include: ${snippet}`);
    }
  }
}

const rootDockerfile = read("Dockerfile");
const backendDockerfile = read("backend/Dockerfile");
const backendStart = read("backend/start.py");
const rootDockerignore = read(".dockerignore");
const backendDockerignore = read("backend/.dockerignore");

requireIncludes("Dockerfile", rootDockerfile, [
  "langgraph.production.json",
  "${PORT:-8000}",
  "0.0.0.0",
]);
requireNotIncludes("Dockerfile", rootDockerfile, ['"--port", "8000"']);

requireIncludes("backend/Dockerfile", backendDockerfile, ['CMD ["python", "start.py"]']);
requireIncludes("backend/start.py", backendStart, ['os.environ.get("PORT", 8000)']);

const requiredDockerignorePatterns = [
  ".env",
  ".env.*",
  ".vercel",
  ".next",
  "node_modules",
  "__pycache__",
  ".pytest_cache",
  ".git",
];

requireIncludes(".dockerignore", rootDockerignore, requiredDockerignorePatterns);
requireIncludes("backend/.dockerignore", backendDockerignore, [
  ".env",
  ".env.*",
  "__pycache__",
  ".pytest_cache",
]);

if (failures.length > 0) {
  console.error("Docker/Railway release readiness check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Docker/Railway release readiness check passed.");
```

**Step 2: Run test to verify expected failures**

Run:

```bash
node --test scripts/check-docker-release-readiness.test.mjs
```

Expected: FAIL. The checker now exists, but the repository should fail because `.dockerignore` and `backend/.dockerignore` are missing and the root `Dockerfile` still hardcodes port `8000`.

**Step 3: Do not over-expand the checker**

Keep this checker limited to static open-source release invariants:

- required Docker files exist
- root Dockerfile uses Railway-compatible `$PORT`
- backend Dockerfile still delegates to `start.py`
- `.env` and local build artifacts are excluded from Docker contexts

Do not add generic Docker linting, dependency policy checks, or model provider validation here.

**Step 4: Commit**

Do not commit yet. Commit after the repository passes the checker in Task 4.

---

### Task 3: Add Docker Ignore Protection

**Files:**
- Create: `.dockerignore`
- Create: `backend/.dockerignore`
- Test: `scripts/check-docker-release-readiness.test.mjs`

**Step 1: Create root `.dockerignore`**

Add `.dockerignore`:

```dockerignore
.git
.gitignore

# Local secrets and deployment state
.env
.env.*
**/.env
**/.env.*
.vercel
**/.vercel

# Node artifacts
node_modules
**/node_modules
.next
**/.next
frontend-old

# Python artifacts
__pycache__
**/__pycache__
.pytest_cache
**/.pytest_cache
.mypy_cache
**/.mypy_cache
.ruff_cache
**/.ruff_cache
*.pyc

# Logs and OS files
*.log
.DS_Store
```

**Step 2: Create `backend/.dockerignore`**

Add `backend/.dockerignore`:

```dockerignore
.env
.env.*

__pycache__
**/__pycache__
.pytest_cache
**/.pytest_cache
.mypy_cache
**/.mypy_cache
.ruff_cache
**/.ruff_cache
*.pyc

data
*.log
.DS_Store
```

**Step 3: Run checker test and confirm remaining failure is port-related**

Run:

```bash
node --test scripts/check-docker-release-readiness.test.mjs
```

Expected: FAIL only on the root `Dockerfile` `$PORT` requirement. If there are still `.dockerignore` failures, fix the patterns before moving on.

---

### Task 4: Fix Root Dockerfile Railway Port Handling

**Files:**
- Modify: `Dockerfile`
- Test: `scripts/check-docker-release-readiness.test.mjs`

**Step 1: Replace JSON-array CMD with shell-expanded CMD**

Change the root `Dockerfile` command from fixed port `8000` to a shell command that expands Railway's `PORT` variable while keeping local fallback:

```dockerfile
CMD ["sh", "-c", "exec python -m langgraph_cli dev --config langgraph.production.json --no-reload --port ${PORT:-8000} --host 0.0.0.0 --allow-blocking"]
```

**Step 2: Run checker test**

Run:

```bash
node --test scripts/check-docker-release-readiness.test.mjs
```

Expected: PASS with output similar to:

```text
Docker/Railway release readiness check passed.
```

**Step 3: Commit**

Run:

```bash
git add Dockerfile .dockerignore backend/.dockerignore scripts/check-docker-release-readiness.mjs scripts/check-docker-release-readiness.test.mjs
git commit -m "fix: harden docker railway deployment path"
```

---

### Task 5: Add CI Coverage For Docker/Railway Readiness

**Files:**
- Modify: `.github/workflows/ci.yml`
- Test: `.github/workflows/ci.yml`

**Step 1: Add a static readiness step to CI**

Add a job or step that runs:

```bash
node scripts/check-docker-release-readiness.mjs
```

Recommended placement: a separate lightweight job before Docker build jobs, so failures are fast and easy to understand.

**Step 2: Add Docker build smoke checks**

Add CI commands for both documented Railway paths:

```bash
docker build -f Dockerfile -t neloo-backend-root .
docker build -f backend/Dockerfile -t neloo-backend-service backend
```

Keep these as build-only smoke checks. Do not add full runtime tests with Postgres in this task unless Docker build passes and there is a clear need; root runtime needs `DATABASE_URL` because `backend/langgraph.production.json` uses Postgres checkpointer/store.

**Step 3: Run local workflow structure check**

Run:

```bash
node scripts/check-github-workflows.mjs
```

Expected: PASS.

If this check fails because it expects exact CI snippets, update `scripts/check-github-workflows.mjs` narrowly to allow the new Docker readiness job while preserving its current root-workflow protections.

**Step 4: Run YAML parse check**

Run:

```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/ci.yml"); puts "workflow yaml ok"'
```

Expected:

```text
workflow yaml ok
```

**Step 5: Commit**

Run:

```bash
git add .github/workflows/ci.yml scripts/check-github-workflows.mjs
git commit -m "ci: verify docker railway readiness"
```

Only include `scripts/check-github-workflows.mjs` if it actually needed a narrow update.

---

### Task 6: Update Deployment Documentation

**Files:**
- Modify: `DEPLOY.md`
- Modify: `README.md`
- Modify if needed: `docs/configuration.md`

**Step 1: Update Railway backend deployment section**

In `DEPLOY.md`, clarify:

- Railway injects `PORT`; users normally do not need to set it manually.
- Root deployment uses the root `Dockerfile` and `backend/langgraph.production.json`.
- Root deployment requires `DATABASE_URL`.
- `backend/` root deployment uses `backend/Dockerfile` and `backend/start.py`.
- `backend/start.py` can start without `DATABASE_URL`, but history will not persist.

**Step 2: Add Docker safety note**

Add a short note:

```markdown
The repository includes `.dockerignore` files so local `.env`, `.env.local`, `.vercel`, `.next`, and dependency artifacts are not copied into Docker build contexts. Keep secrets in environment variables, not in committed files or images.
```

**Step 3: Add local verification commands**

Add commands:

```bash
docker build -f Dockerfile -t neloo-backend-root .
docker build -f backend/Dockerfile -t neloo-backend-service backend
```

Add backend runtime smoke command:

```bash
docker run --rm -e PORT=8000 -p 8000:8000 neloo-backend-service
curl http://localhost:8000/health
```

Mention that root runtime smoke requires a valid `DATABASE_URL` because it uses `backend/langgraph.production.json`.

**Step 4: Keep README concise**

In `README.md`, do not duplicate the full deployment guide. Add only a short pointer to `DEPLOY.md` that mentions Docker/Railway verification and secret-safe Docker contexts.

**Step 5: Commit**

Run:

```bash
git add DEPLOY.md README.md docs/configuration.md
git commit -m "docs: clarify docker railway deployment checks"
```

Only include `docs/configuration.md` if it was actually changed.

---

### Task 7: Final Verification

**Files:**
- Read: `Dockerfile`
- Read: `backend/Dockerfile`
- Read: `.dockerignore`
- Read: `backend/.dockerignore`
- Read: `.github/workflows/ci.yml`
- Read: `DEPLOY.md`

**Step 1: Run static checks**

Run:

```bash
node --test scripts/check-docker-release-readiness.test.mjs
node scripts/check-docker-release-readiness.mjs
node scripts/check-github-workflows.mjs
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/ci.yml"); puts "workflow yaml ok"'
```

Expected: all pass.

**Step 2: Run Docker build verification**

Run:

```bash
docker build -f Dockerfile -t neloo-backend-root .
docker build -f backend/Dockerfile -t neloo-backend-service backend
```

Expected: both builds pass.

If Docker daemon is unavailable locally, do not mark runtime/build verification complete. Record this explicitly in the final response and rely on GitHub Actions after pushing.

**Step 3: Run backend runtime smoke if Docker is available**

Run:

```bash
docker run --rm -d --name neloo-backend-smoke -e PORT=8000 -p 8000:8000 neloo-backend-service
sleep 10
curl -f http://localhost:8000/health
docker stop neloo-backend-smoke
```

Expected: `curl` succeeds with a healthy response.

If startup takes longer because dependencies initialize slowly, inspect logs:

```bash
docker logs neloo-backend-smoke
```

Then retry `curl`.

**Step 4: Run existing non-Docker checks**

Run:

```bash
git diff --check
```

Expected: no output.

Do not run full frontend format/lint cleanup as part of this plan; that is a separate open-source readiness item.

**Step 5: Final commit if needed**

If verification required small corrections, commit them:

```bash
git add .
git commit -m "chore: verify docker railway readiness"
```

Skip this commit if there are no changes after verification.

---

### Acceptance Criteria

- Root `Dockerfile` listens on Railway's `PORT` with local fallback to `8000`.
- Root `.dockerignore` prevents local secrets and build artifacts from entering Docker context.
- `backend/.dockerignore` prevents `backend/.env` from entering the backend Docker context.
- Static Docker/Railway readiness checker passes locally and in CI.
- CI attempts Docker builds for both documented Railway paths.
- Deployment docs clearly explain the two Railway paths, `PORT`, `DATABASE_URL`, and Docker secret-safety.
- No unrelated model, frontend UI, README translation, or lint cleanup changes are included in this work.
