import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeEnvironment,
  formatReport,
  parseEnvContent,
} from "./check-env.mjs";

test("parseEnvContent ignores comments and unquotes values", () => {
  const parsed = parseEnvContent(`
# comment
DEEPSEEK_API_KEY="abc"
NEXT_PUBLIC_API_URL=http://localhost:2024
EMPTY=
`);
  assert.equal(parsed.DEEPSEEK_API_KEY, "abc");
  assert.equal(parsed.NEXT_PUBLIC_API_URL, "http://localhost:2024");
  assert.equal(parsed.EMPTY, "");
});

test("analyzeEnvironment fails when required env files are missing", () => {
  const report = analyzeEnvironment({
    backend: { exists: false, values: {} },
    frontend: { exists: false, values: {} },
  });
  assert.equal(report.ok, false);
  assert.equal(report.items.some((item) => item.code === "missing-backend-env"), true);
  assert.equal(report.items.some((item) => item.code === "missing-frontend-env"), true);
});

test("analyzeEnvironment reports missing model key and frontend API URL", () => {
  const report = analyzeEnvironment({
    backend: { exists: true, values: { SANDBOX_MODE: "local" } },
    frontend: { exists: true, values: {} },
  });
  assert.equal(report.ok, false);
  assert.equal(report.items.some((item) => item.code === "missing-chat-model-key"), true);
  assert.equal(report.items.some((item) => item.code === "missing-next-public-api-url"), true);
});

test("analyzeEnvironment rejects server secrets in frontend env", () => {
  const report = analyzeEnvironment({
    backend: { exists: true, values: { DEEPSEEK_API_KEY: "backend-key", SANDBOX_MODE: "local" } },
    frontend: {
      exists: true,
      values: {
        NEXT_PUBLIC_API_URL: "http://localhost:2024",
        SUPABASE_SERVICE_KEY: "service-secret",
      },
    },
  });
  assert.equal(report.ok, false);
  assert.equal(report.items.some((item) => item.code === "server-secret-in-frontend"), true);
});

test("analyzeEnvironment passes local minimal config with warnings only", () => {
  const report = analyzeEnvironment({
    backend: {
      exists: true,
      values: {
        DEEPSEEK_API_KEY: "key",
        SANDBOX_MODE: "local",
        FILE_SECRET_KEY: "change-me-to-a-random-32-byte-secret",
        IMAGE_SECRET_KEY: "change-me-to-a-random-32-byte-secret",
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
  assert.match(formatReport(report), /usable with warnings/);
});
