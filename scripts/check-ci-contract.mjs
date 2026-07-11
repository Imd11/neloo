#!/usr/bin/env node
import fs from "node:fs";

const ci = fs.readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const security = fs.existsSync(new URL("../.github/workflows/security.yml", import.meta.url))
  ? fs.readFileSync(new URL("../.github/workflows/security.yml", import.meta.url), "utf8")
  : "";

const required = [
  [ci, "backend-test", "backend test job"],
  [ci, "ruff check src tests", "backend ruff gate"],
  [ci, "pytest -q", "backend pytest gate"],
  [ci, "frontend-test", "frontend test job"],
  [ci, "yarn lint", "frontend lint gate"],
  [ci, "npx tsc --noEmit", "frontend type gate"],
  [ci, "yarn test", "frontend unit tests"],
  [ci, "yarn build", "frontend build gate"],
  [ci, "database-test", "database migration job"],
  [ci, "schema_smoke.sql", "fresh schema smoke"],
  [ci, "test-legacy-database-upgrade.sh", "legacy upgrade test"],
  [ci, "guest_data_rls.sql", "RLS test"],
  [ci, "runtime-auth-smoke", "runtime auth job"],
  [ci, "check-runtime-auth.sh", "runtime auth script"],
  [ci, "configurator-test", "configurator job"],
  [ci, "docker-readiness", "docker build job"],
  [security, "check-production-dependencies.mjs", "production dependency audit"],
  [security, "pip-audit", "Python vulnerability audit"],
  [security, "gitleaks", "secret scan"],
];

const missing = required.filter(([content, token]) => !content.includes(token));
if (/continue-on-error:\s*true/.test(ci)) {
  console.error("CI contract violation: required CI contains continue-on-error: true");
  process.exitCode = 1;
}
for (const [, , label] of missing) console.error(`CI contract violation: missing ${label}`);
if (missing.length) process.exitCode = 1;
if (!process.exitCode) console.log("CI contract is complete and blocking.");
