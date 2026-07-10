import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeEnvironment,
  formatReport,
  parseEnvContent,
} from "./check-env.mjs";

function reportFor(backendValues, frontendValues = {}) {
  return analyzeEnvironment({
    backend: {
      exists: true,
      values: {
        SANDBOX_MODE: "local",
        ...backendValues,
      },
    },
    frontend: {
      exists: true,
      values: {
        NEXT_PUBLIC_API_URL: "http://localhost:2024",
        ...frontendValues,
      },
    },
  });
}

function hasCode(report, code) {
  return report.items.some((item) => item.code === code);
}

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

test("analyzeEnvironment rejects Gemini key without required base URL", () => {
  const report = reportFor({ GEMINI_API_KEY: "key" });

  assert.equal(report.ok, false);
  assert.equal(hasCode(report, "missing-complete-chat-model-config"), true);
  assert.match(formatReport(report), /Gemini/);
  assert.match(formatReport(report), /GEMINI_BASE_URL/);
});

test("analyzeEnvironment rejects custom OpenAI key without base URL and model", () => {
  const report = reportFor({ CUSTOM_OPENAI_API_KEY: "key" });

  assert.equal(report.ok, false);
  assert.equal(hasCode(report, "missing-complete-chat-model-config"), true);
  assert.match(formatReport(report), /Custom OpenAI-compatible/);
  assert.match(formatReport(report), /CUSTOM_OPENAI_BASE_URL/);
  assert.match(formatReport(report), /CUSTOM_OPENAI_MODEL/);
});

test("analyzeEnvironment accepts complete custom OpenAI config", () => {
  const report = reportFor({
    CUSTOM_OPENAI_API_KEY: "key",
    CUSTOM_OPENAI_BASE_URL: "https://example.test/v1",
    CUSTOM_OPENAI_MODEL: "my-model",
  });

  assert.equal(report.ok, true);
  assert.equal(hasCode(report, "missing-complete-chat-model-config"), false);
});

test("analyzeEnvironment warns about incomplete extra provider when one provider is usable", () => {
  const report = reportFor({
    DEEPSEEK_API_KEY: "key",
    GEMINI_API_KEY: "gemini-key",
  });

  assert.equal(report.ok, true);
  assert.equal(hasCode(report, "incomplete-chat-model-config"), true);
  assert.match(formatReport(report), /GEMINI_BASE_URL/);
});

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

test("local profile warns when durable thread persistence is not configured", () => {
  const report = reportFor({ DEEPSEEK_API_KEY: "key" });

  assert.equal(report.ok, true);
  assert.equal(hasCode(report, "no-durable-thread-persistence"), true);
});

test("analyzeEnvironment warns when backend Supabase URL is malformed", () => {
  const report = reportFor({
    DEEPSEEK_API_KEY: "key",
    SUPABASE_URL: "your-project-ref",
    SUPABASE_SERVICE_KEY: "service-key",
  });

  assert.equal(report.ok, true);
  assert.equal(hasCode(report, "invalid-backend-supabase-url"), true);
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

test("analyzeEnvironment allows Next.js server-route secrets in frontend env", () => {
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
  assert.equal(report.ok, true);
  assert.equal(report.items.some((item) => item.code === "server-secret-in-frontend"), false);
});

test("public browser-side provider keys fail", () => {
  const report = reportFor(
    { DEEPSEEK_API_KEY: "backend-key" },
    {
      NEXT_PUBLIC_OPENAI_API_KEY: "browser-key",
    }
  );

  assert.equal(report.ok, false);
  assert.equal(hasCode(report, "server-secret-in-frontend"), true);
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

test("analyzeEnvironment warns when Gemini image model has no server key", () => {
  const report = reportFor(
    { DEEPSEEK_API_KEY: "backend-key" },
    { GEMINI_IMAGE_MODEL: "gemini-3.1-flash-image" }
  );

  assert.equal(report.ok, true);
  assert.equal(hasCode(report, "partial-gemini-image-config"), true);
});

test("analyzeEnvironment rejects a public Gemini image key", () => {
  const report = reportFor(
    { DEEPSEEK_API_KEY: "backend-key" },
    { NEXT_PUBLIC_GEMINI_IMAGE_API_KEY: "browser-key" }
  );

  assert.equal(report.ok, false);
  assert.equal(hasCode(report, "server-secret-in-frontend"), true);
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
