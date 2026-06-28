# GitHub Actions Root Workflows Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the frontend GitHub workflow files to the repository root so GitHub Actions actually discovers them, while preserving the intended frontend build/lint behavior.

**Architecture:** GitHub only discovers workflows under the repository root `.github/workflows/` directory. Relocate workflows from `frontend/.github/workflows/` to `.github/workflows/`, adjust frontend jobs to run from `frontend/`, and remove the now-dead nested workflow files to avoid misleading maintainers. Because the current frontend already has lint and Prettier debt, keep quality checks visible but report-only for now; keep the frontend build blocking.

**Tech Stack:** GitHub Actions YAML, Yarn 1, Next.js frontend scripts, codespell action, semantic PR title action.

---

## Constraints

- Do not change frontend application code.
- Do not attempt broad lint cleanup; existing frontend lint debt remains documented and non-blocking.
- Do not change backend deployment, model configuration, README content, or configurator behavior in this plan.
- Keep the CI behavior minimal and honest:
  - format job runs `yarn format:check` with `continue-on-error: true` because current formatting debt is pre-existing
  - lint job runs `yarn run lint` with `continue-on-error: true`
  - build job runs `yarn build`
  - README spelling checks root `README.md` in report-only mode until codespell is locally verified
  - code spelling checks frontend source in report-only mode until codespell is locally verified
  - PR title lint keeps the existing semantic title policy
- Use Yarn 1 with `--frozen-lockfile`; do not introduce Yarn Berry flags such as `--immutable`.
- Explicitly activate Yarn 1 in GitHub Actions with `corepack prepare yarn@1.22.22 --activate`.
- Do not commit a deliberately failing intermediate state; commit after the workflow discoverability check passes.
- Use `karpathy-guidelines` while implementing.
- Use `verification-before-completion` before reporting completion.

---

### Task 1: Add A Regression Check For Workflow Discoverability

**Files:**
- Create: `scripts/check-github-workflows.mjs`

**Problem:**

The current workflows live under `frontend/.github/workflows/`, which GitHub Actions does not auto-discover. A small repository-level check prevents this mistake from recurring.

**Step 1: Write the failing check script**

Create the script directory if needed:

```bash
cd <repo-root>
mkdir -p scripts
```

Then create `scripts/check-github-workflows.mjs`:

```javascript
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rootWorkflowDir = path.join(root, ".github", "workflows");
const nestedWorkflowDir = path.join(root, "frontend", ".github", "workflows");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!fs.existsSync(rootWorkflowDir)) {
  fail("Missing root .github/workflows directory.");
} else {
  const workflows = fs.readdirSync(rootWorkflowDir).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));
  if (!workflows.includes("ci.yml")) {
    fail("Missing .github/workflows/ci.yml.");
  }
  if (!workflows.includes("pr_lint.yml")) {
    fail("Missing .github/workflows/pr_lint.yml.");
  }
}

if (fs.existsSync(nestedWorkflowDir)) {
  const nested = fs.readdirSync(nestedWorkflowDir).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));
  if (nested.length > 0) {
    fail(`Nested frontend workflow files are not discovered by GitHub Actions: ${nested.join(", ")}`);
  }
}

function requireSnippet(content, snippet) {
  if (!content.includes(snippet)) {
    fail(`Missing expected CI snippet: ${snippet}`);
  }
}

function requirePattern(content, pattern, message) {
  if (!pattern.test(content)) {
    fail(message);
  }
}

const ciPath = path.join(rootWorkflowDir, "ci.yml");
if (fs.existsSync(ciPath)) {
  const ci = fs.readFileSync(ciPath, "utf8");
  requireSnippet(ci, "working-directory: frontend");
  requireSnippet(ci, "cache-dependency-path: frontend/yarn.lock");
  requireSnippet(ci, "corepack prepare yarn@1.22.22 --activate");
  requireSnippet(ci, "yarn install --frozen-lockfile");
  requireSnippet(ci, "yarn build");
  requireSnippet(ci, "path: README.md");
  requireSnippet(ci, "path: frontend/src");
  requireSnippet(ci, "ignore_words_file: frontend/.codespellignore");
  requirePattern(
    ci,
    /name: Check formatting[\s\S]*continue-on-error: true[\s\S]*run: yarn format:check/,
    "Formatting check must be report-only while existing formatting debt remains."
  );
  requirePattern(
    ci,
    /name: Check linting[\s\S]*continue-on-error: true[\s\S]*run: yarn run lint/,
    "Lint check must be report-only while existing lint debt remains."
  );
  requirePattern(
    ci,
    /name: Check README spelling[\s\S]*continue-on-error: true[\s\S]*path: README\.md/,
    "README spelling check must be report-only until codespell is locally verified."
  );
  requirePattern(
    ci,
    /name: Check frontend spelling[\s\S]*continue-on-error: true[\s\S]*path: frontend\/src/,
    "Frontend spelling check must be report-only until codespell is locally verified."
  );

  if (ci.includes("--immutable") || ci.includes("--mode=skip-build")) {
    fail("CI must use Yarn 1 flags, not Yarn Berry flags.");
  }
}
```

**Step 2: Run the check and verify it fails**

Run:

```bash
cd <repo-root>
node scripts/check-github-workflows.mjs
```

Expected: FAIL with messages including:

```text
Missing root .github/workflows directory.
Nested frontend workflow files are not discovered by GitHub Actions: ci.yml, pr_lint.yml
```

**Step 3: Do not commit the failing check yet**

Keep the failing script in the working tree. It should be committed only after Tasks 2 and 3 make it pass, so `main` history does not contain a deliberately failing verification state.

---

### Task 2: Move The CI Workflow To Root And Adjust Frontend Working Directory

**Files:**
- Create: `.github/workflows/ci.yml`
- Delete: `frontend/.github/workflows/ci.yml`

**Problem:**

The current CI workflow has the right intent but the wrong location. After moving to the root, frontend commands must run in `frontend/`, and setup-node must cache the frontend Yarn lockfile explicitly.

**Step 1: Create the root CI workflow**

Create the root workflow directory if needed:

```bash
cd <repo-root>
mkdir -p .github/workflows
```

Then create `.github/workflows/ci.yml` with:

```yaml
# Run frontend checks and repository spelling checks.

name: CI

on:
  push:
    branches: ["main"]
  pull_request:
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  format:
    name: Check frontend formatting
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js 20.x
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: "yarn"
          cache-dependency-path: frontend/yarn.lock
      - name: Enable Corepack
        run: corepack enable
      - name: Use Yarn 1
        run: corepack prepare yarn@1.22.22 --activate
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      - name: Check formatting
        continue-on-error: true
        run: yarn format:check

  lint:
    name: Check frontend linting
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js 20.x
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: "yarn"
          cache-dependency-path: frontend/yarn.lock
      - name: Enable Corepack
        run: corepack enable
      - name: Use Yarn 1
        run: corepack prepare yarn@1.22.22 --activate
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      - name: Check linting
        continue-on-error: true
        run: yarn run lint

  build:
    name: Build frontend
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js 20.x
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: "yarn"
          cache-dependency-path: frontend/yarn.lock
      - name: Enable Corepack
        run: corepack enable
      - name: Use Yarn 1
        run: corepack prepare yarn@1.22.22 --activate
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      - name: Build
        run: yarn build

  readme-spelling:
    name: Check README spelling
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: codespell-project/actions-codespell@v2
        continue-on-error: true
        with:
          ignore_words_file: frontend/.codespellignore
          path: README.md

  check-spelling:
    name: Check frontend spelling
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: codespell-project/actions-codespell@v2
        continue-on-error: true
        with:
          ignore_words_file: frontend/.codespellignore
          path: frontend/src
```

**Step 2: Remove the nested CI workflow**

Run:

```bash
cd <repo-root>
rm frontend/.github/workflows/ci.yml
```

Only delete this workflow file. Do not delete other frontend files.

**Step 3: Run the workflow discoverability check**

Run:

```bash
cd <repo-root>
node scripts/check-github-workflows.mjs
```

Expected: still FAIL because `pr_lint.yml` has not moved yet, but there should be no missing `.github/workflows/ci.yml` failure.

**Step 4: Verify frontend commands still work locally**

Run:

```bash
cd <repo-root>/frontend
yarn build
yarn format:check > /tmp/neloo-frontend-format-after-ci-move.txt 2>&1 || true
tail -n 12 /tmp/neloo-frontend-format-after-ci-move.txt
yarn lint > /tmp/neloo-frontend-lint-after-ci-move.txt 2>&1 || true
tail -n 12 /tmp/neloo-frontend-lint-after-ci-move.txt
```

Expected:

- `yarn build` passes.
- `yarn format:check` still reports the documented existing formatting debt and does not become part of this fix.
- `yarn lint` still reports the documented existing lint debt and does not become part of this fix.

**Step 5: Do not commit yet**

The workflow discoverability check should still fail until the PR title workflow is moved. Keep these changes in the working tree and commit after Task 3 passes.

---

### Task 3: Move The PR Title Workflow To Root Or Remove The Dead Nested Copy

**Files:**
- Create: `.github/workflows/pr_lint.yml`
- Delete: `frontend/.github/workflows/pr_lint.yml`

**Problem:**

The nested PR title workflow is also undiscovered. Leaving it under `frontend/.github/workflows/` would preserve a misleading dead workflow next to the fixed CI workflow.

**Step 1: Create the root PR title workflow**

Create `.github/workflows/pr_lint.yml` with the same policy as the current nested file:

```yaml
name: PR Title Lint

permissions:
  pull-requests: read

on:
  pull_request:
    types: [opened, edited, synchronize]

jobs:
  lint-pr-title:
    runs-on: ubuntu-latest
    steps:
      - name: Validate PR Title
        uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          types: |
            feat
            fix
            docs
            style
            refactor
            perf
            test
            build
            ci
            chore
            revert
            release
          scopes: |
            shared
            cli
            web
            open-swe
            docs
          requireScope: false
          ignoreLabels: |
            ignore-lint-pr-title
```

**Step 2: Remove the nested PR title workflow**

Run:

```bash
cd <repo-root>
rm frontend/.github/workflows/pr_lint.yml
```

If `frontend/.github/workflows/` is now empty, remove the empty directory:

```bash
rmdir frontend/.github/workflows frontend/.github 2>/dev/null || true
```

**Step 3: Run the workflow discoverability check**

Run:

```bash
cd <repo-root>
node scripts/check-github-workflows.mjs
```

Expected: PASS with exit code 0.

**Step 4: Validate YAML parses locally**

Run:

```bash
cd <repo-root>
ruby -e "require 'yaml'; YAML.load_file('.github/workflows/ci.yml'); YAML.load_file('.github/workflows/pr_lint.yml'); puts 'workflow yaml ok'"
```

Expected:

```text
workflow yaml ok
```

If `ruby` is unavailable, use any local YAML parser already available in the environment. Do not add a new dependency just to parse YAML.

**Step 5: Commit**

```bash
cd <repo-root>
git add .github/workflows/pr_lint.yml frontend/.github/workflows/pr_lint.yml scripts/check-github-workflows.mjs
git add .github/workflows/ci.yml frontend/.github/workflows/ci.yml
git commit -m "ci: move github workflows to root"
```

---

### Task 4: Update The Lint Debt Note To Mention Real GitHub Workflow Location

**Files:**
- Modify: `docs/frontend-lint-notes.md`

**Problem:**

The lint debt note currently documents the lint state, but after moving the workflow it should point maintainers to the real root workflow file and explain that current format/lint/spelling quality checks are report-only while existing debt is visible.

**Step 1: Patch the note narrowly**

Update `docs/frontend-lint-notes.md` to include:

```markdown
GitHub Actions runs the frontend lint job from `.github/workflows/ci.yml`. The lint step is intentionally `continue-on-error: true` so existing debt stays visible without blocking unrelated open-source setup work.

The frontend formatting check is also report-only for now because `yarn format:check` currently reports existing Prettier debt. Build remains blocking.
```

Do not expand the note into a full lint cleanup plan.

**Step 2: Verify references**

Run:

```bash
cd <repo-root>
rg -n "continue-on-error|\\.github/workflows/ci.yml|105 problems|format:check|frontend lint|Build remains blocking" docs/frontend-lint-notes.md .github/workflows/ci.yml
```

Expected:

- The note references `.github/workflows/ci.yml`.
- The workflow contains `continue-on-error: true` for format, lint, and spelling report-only checks.

**Step 3: Commit**

```bash
cd <repo-root>
git add docs/frontend-lint-notes.md
git commit -m "docs: point lint debt note to root workflow"
```

---

### Task 5: Final Verification And Push Readiness

**Files:**
- Check: `.github/workflows/ci.yml`
- Check: `.github/workflows/pr_lint.yml`
- Check: `scripts/check-github-workflows.mjs`
- Check: `docs/frontend-lint-notes.md`
- Check: git state

**Step 1: Verify workflow files are only in the root discoverable location**

Run:

```bash
cd <repo-root>
git ls-files | grep -E '(^|/)\.github/workflows/.*\.ya?ml$' | sort
if git ls-files | grep -q '^frontend/\.github/workflows/'; then
  echo "frontend nested workflows are still tracked"
  exit 1
fi
node scripts/check-github-workflows.mjs
```

Expected:

```text
.github/workflows/ci.yml
.github/workflows/pr_lint.yml
```

Use `git ls-files` for this check, not raw `find`, because ignored local directories such as `node_modules` or `frontend-old` can contain third-party `.github/workflows` files that are not part of this repository.

**Step 2: Verify frontend build still passes and lint remains documented**

Run:

```bash
cd <repo-root>/frontend
yarn build
yarn format:check > /tmp/neloo-frontend-format-final.txt 2>&1 || true
tail -n 12 /tmp/neloo-frontend-format-final.txt
yarn lint > /tmp/neloo-frontend-lint-final.txt 2>&1 || true
tail -n 12 /tmp/neloo-frontend-lint-final.txt
```

Expected:

- Build passes.
- Format check still reports known existing debt.
- Lint still reports the known existing debt.
- Do not claim format or lint is clean.

**Step 2.5: Verify codespell locally when available**

Run:

```bash
cd <repo-root>
if python3 -m codespell --version >/dev/null 2>&1; then
  python3 -m codespell README.md --ignore-words=frontend/.codespellignore
  python3 -m codespell frontend/src --ignore-words=frontend/.codespellignore
elif command -v codespell >/dev/null 2>&1; then
  codespell README.md --ignore-words=frontend/.codespellignore
  codespell frontend/src --ignore-words=frontend/.codespellignore
else
  echo "codespell unavailable locally; GitHub spelling checks are report-only"
fi
```

Expected:

- If codespell is available, either it passes or any failures are documented as existing report-only spelling debt.
- If codespell is unavailable locally, final report says spelling checks were not locally verified and are report-only in GitHub Actions.

**Step 3: Verify backend and configurator were not affected**

Run:

```bash
cd <repo-root>/backend
uv run --with pytest python -m pytest tests/test_model_ids.py tests/test_langgraph_configs.py tests/test_dockerfiles.py -q
rm -f uv.lock
cd <repo-root>
node --test neloo-configurator/scripts/*.test.mjs
```

Expected:

- Backend selected tests pass.
- Configurator tests pass.

**Step 4: Verify open-source safety checks remain clean**

Run:

```bash
cd <repo-root>
grep -R -n -E "Data Analyst Agent|Deepagents UI|deep-agents-ui|apps/data-analyst|data-analyst-agent|data-analyst-frontend" \
  README.md backend/README.md frontend/README.md ARCHITECTURE.md DEPLOY.md DATABASE_MIGRATION_GUIDE.md Dockerfile backend/Dockerfile backend/start.py docs \
  --exclude-dir=plans || true
git ls-files | grep -E '(^|/)\.env($|\.local|\.production)|(^|/)\.vercel(/|$)' || true
git diff --check
```

Expected:

- No stale public identity matches.
- No tracked env or Vercel local files.
- No whitespace errors.

**Step 5: Review git state**

Run:

```bash
cd <repo-root>
git status --short --branch
git log --oneline --decorate -8
```

Expected:

- Only intended workflow/check/docs changes are present.
- No generated files are staged or untracked.

**Step 6: Push only when requested**

If the user asks to execute and push after this plan is accepted, run:

```bash
cd <repo-root>
git push origin main
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

Expected:

- Push succeeds.
- `HEAD` equals `origin/main`.
