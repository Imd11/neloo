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
  const workflows = fs
    .readdirSync(rootWorkflowDir)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));
  if (!workflows.includes("ci.yml")) {
    fail("Missing .github/workflows/ci.yml.");
  }
  if (!workflows.includes("pr_lint.yml")) {
    fail("Missing .github/workflows/pr_lint.yml.");
  }
}

if (fs.existsSync(nestedWorkflowDir)) {
  const nested = fs
    .readdirSync(nestedWorkflowDir)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));
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
  requireSnippet(ci, "node scripts/check-docker-release-readiness.mjs");
  requireSnippet(ci, "docker build -f Dockerfile -t neloo-backend-root .");
  requireSnippet(ci, "docker build -f backend/Dockerfile -t neloo-backend-service backend");
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
