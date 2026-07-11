#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CHAT_MODEL_KEYS = [
  "DEEPSEEK_API_KEY",
  "QWEN_API_KEY",
  "MINIMAX_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "ZHIPU_API_KEY",
  "CUSTOM_OPENAI_API_KEY",
  "CUSTOM_ANTHROPIC_API_KEY",
  "NEWAPI_API_KEY",
];

export const CHAT_MODEL_CONFIGS = [
  {
    id: "deepseek",
    label: "DeepSeek",
    credentials: [{ key: "DEEPSEEK_API_KEY" }],
  },
  {
    id: "qwen",
    label: "Qwen",
    credentials: [{ key: "QWEN_API_KEY", required: ["QWEN_BASE_URL"] }],
  },
  {
    id: "minimax",
    label: "MiniMax",
    credentials: [{ key: "MINIMAX_API_KEY", required: ["MINIMAX_ANTHROPIC_BASE_URL"] }],
  },
  {
    id: "anthropic",
    label: "Claude",
    credentials: [
      { key: "ANTHROPIC_API_KEY" },
      { key: "NEWAPI_API_KEY", required: ["NEWAPI_ANTHROPIC_BASE_URL"] },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    credentials: [{ key: "OPENAI_API_KEY" }],
  },
  {
    id: "gemini",
    label: "Gemini",
    credentials: [{ key: "GEMINI_API_KEY", required: ["GEMINI_BASE_URL"] }],
  },
  {
    id: "zhipu",
    label: "GLM",
    credentials: [{ key: "ZHIPU_API_KEY", required: ["ZHIPU_BASE_URL"] }],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    credentials: [{ key: "OPENROUTER_API_KEY", required: ["OPENROUTER_BASE_URL"] }],
  },
  {
    id: "custom-openai",
    label: "Custom OpenAI-compatible",
    credentials: [
      {
        key: "CUSTOM_OPENAI_API_KEY",
        required: ["CUSTOM_OPENAI_BASE_URL", "CUSTOM_OPENAI_MODEL"],
      },
    ],
  },
  {
    id: "custom-anthropic",
    label: "Custom Anthropic-compatible",
    credentials: [
      {
        key: "CUSTOM_ANTHROPIC_API_KEY",
        required: ["CUSTOM_ANTHROPIC_BASE_URL", "CUSTOM_ANTHROPIC_MODEL"],
      },
    ],
  },
];

export const SERVER_ONLY_KEYS = [
  ...CHAT_MODEL_KEYS,
  "GEMINI_IMAGE_API_KEY",
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_JWT_SECRET",
  "DATABASE_URL",
  "SUPABASE_DB_PASSWORD",
  "E2B_API_KEY",
  "TAVILY_API_KEY",
  "COMPOSIO_API_KEY",
  "COMPOSIO_AUTH_CONFIGS_JSON",
  "LANGSMITH_API_KEY",
  "ANONYMOUS_SESSION_SECRET",
  "RATE_LIMIT_REDIS_URL",
];

const PUBLIC_FRONTEND_KEYS = [
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_ASSISTANT_ID",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_LANGSMITH_API_KEY",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
  "NEXT_PUBLIC_GOOGLE_API_KEY",
  "NEXT_PUBLIC_BACKEND_URL",
];

const ALLOWED_PUBLIC_PROVIDER_KEYS = new Set([]);

export function parseEnvContent(content) {
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, values: {} };
  }
  return {
    exists: true,
    values: parseEnvContent(fs.readFileSync(filePath, "utf8")),
  };
}

export function hasValue(values, key) {
  return Boolean(values[key] && values[key].trim());
}

function hasValidUrl(value) {
  try {
    const parsed = new URL(value);
    return Boolean(parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function missingRequired(values, credential) {
  return (credential.required || []).filter((key) => !hasValue(values, key));
}

function describeCredential(credential) {
  const required = credential.required && credential.required.length > 0
    ? ` plus ${credential.required.join(" + ")}`
    : "";
  return `${credential.key}${required}`;
}

export function evaluateChatModelConfigs(values) {
  const complete = [];
  const incomplete = [];

  for (const config of CHAT_MODEL_CONFIGS) {
    let configComplete = false;

    for (const credential of config.credentials) {
      if (!hasValue(values, credential.key)) continue;

      const missing = missingRequired(values, credential);
      if (missing.length === 0) {
        configComplete = true;
        complete.push({
          id: config.id,
          label: config.label,
          credential: credential.key,
        });
      } else {
        incomplete.push({
          id: config.id,
          label: config.label,
          credential: credential.key,
          missing,
          expected: describeCredential(credential),
        });
      }
    }

    if (configComplete) {
      for (let i = incomplete.length - 1; i >= 0; i -= 1) {
        if (incomplete[i].id === config.id) incomplete.splice(i, 1);
      }
    }
  }

  return { complete, incomplete };
}

function formatIncompleteChatModels(incomplete) {
  return incomplete
    .map((item) => `${item.label} (${item.credential}) missing ${item.missing.join(", ")}`)
    .join("; ");
}

function add(report, level, code, message, file = "") {
  report.items.push({ level, code, message, file });
}

export function analyzeEnvironment({ backend, frontend, profile = "local-minimal" }) {
  const report = { ok: true, items: [] };
  const backendValues = backend.values || {};
  const frontendValues = frontend.values || {};
  const isProductionProfile = profile === "production-railway-vercel";

  if (!backend.exists) {
    add(report, "error", "missing-backend-env", "Missing backend/.env. Copy backend/.env.example first.", "backend/.env");
  }
  if (!frontend.exists) {
    add(report, "error", "missing-frontend-env", "Missing frontend/.env.local. Copy frontend/.env.example first.", "frontend/.env.local");
  }

  if (frontend.exists && !hasValue(frontendValues, "NEXT_PUBLIC_API_URL")) {
    add(report, "error", "missing-next-public-api-url", "NEXT_PUBLIC_API_URL is required so the browser can reach the backend.", "frontend/.env.local");
  }

  if (backend.exists) {
    const anonymousEnabled = (backendValues.ALLOW_ANONYMOUS || "").toLowerCase() === "true";
    if (!anonymousEnabled) {
      add(report, "error", "anonymous-local-mode-disabled", "Neloo has no login screen. Set ALLOW_ANONYMOUS=true so the browser can use protected features.", "backend/.env");
    }
    if (isProductionProfile && !hasValue(backendValues, "ANONYMOUS_SESSION_SECRET")) {
      add(report, "error", "missing-anonymous-session-secret", "Production guest mode requires ANONYMOUS_SESSION_SECRET. Use the same server-only value in backend/.env and frontend/.env.local.", "backend/.env");
    }
    if (isProductionProfile && !hasValue(backendValues, "RATE_LIMIT_REDIS_URL")) {
      add(report, "error", "missing-rate-limit-redis", "Production requires RATE_LIMIT_REDIS_URL for shared usage limits.", "backend/.env");
    }
    const hasAnyChatKey = CHAT_MODEL_KEYS.some((key) => hasValue(backendValues, key));
    const chatModelStatus = evaluateChatModelConfigs(backendValues);

    if (!hasAnyChatKey) {
      add(report, "error", "missing-chat-model-key", `Set at least one backend chat model key: ${CHAT_MODEL_KEYS.join(", ")}.`, "backend/.env");
    } else if (chatModelStatus.complete.length === 0) {
      const details = chatModelStatus.incomplete.length > 0
        ? ` Incomplete provider config: ${formatIncompleteChatModels(chatModelStatus.incomplete)}.`
        : "";
      add(report, "error", "missing-complete-chat-model-config", `Set at least one complete backend chat model provider configuration.${details}`, "backend/.env");
    } else if (chatModelStatus.incomplete.length > 0) {
      add(report, "warning", "incomplete-chat-model-config", `Some configured model providers will not appear as available: ${formatIncompleteChatModels(chatModelStatus.incomplete)}.`, "backend/.env");
    }
  }

  if (backend.exists) {
    for (const key of ["FILE_SECRET_KEY", "IMAGE_SECRET_KEY"]) {
      const value = backendValues[key] || "";
      if (!value || value.includes("change-me")) {
        add(report, "warning", `weak-${key.toLowerCase()}`, `${key} should be replaced with a stable random secret before production.`, "backend/.env");
      }
    }

    const sandboxMode = (backendValues.SANDBOX_MODE || "").toLowerCase();
    if (sandboxMode.startsWith("e2b") && !hasValue(backendValues, "E2B_API_KEY")) {
      add(report, "error", "missing-e2b-key", "E2B_API_KEY is required when SANDBOX_MODE uses E2B.", "backend/.env");
    }

    const hasSupabaseUrl = hasValue(backendValues, "SUPABASE_URL");
    const hasSupabaseService = hasValue(backendValues, "SUPABASE_SERVICE_KEY");
    if (hasSupabaseUrl !== hasSupabaseService) {
      add(report, "warning", "partial-backend-supabase", "Backend Supabase storage/database usually needs both SUPABASE_URL and SUPABASE_SERVICE_KEY.", "backend/.env");
    } else if (!hasSupabaseUrl && !hasSupabaseService) {
      add(report, "warning", "no-durable-thread-persistence", "Durable chat history, share links, fork/regenerate history, and DB spot checks require SUPABASE_URL plus SUPABASE_SERVICE_KEY.", "backend/.env");
    }
    if (hasSupabaseUrl && !hasValidUrl(backendValues.SUPABASE_URL)) {
      add(report, "warning", "invalid-backend-supabase-url", "SUPABASE_URL must be a full URL such as https://your-project-ref.supabase.co. Durable history/share/fork will fail until it points to a reachable Supabase project.", "backend/.env");
    }

    if (hasValue(backendValues, "COMPOSIO_API_KEY") && !hasValue(backendValues, "COMPOSIO_AUTH_CONFIGS_JSON")) {
      add(report, "warning", "missing-composio-auth-configs", "COMPOSIO_API_KEY is set, but Connected Apps also needs COMPOSIO_AUTH_CONFIGS_JSON with auth config IDs from your Composio workspace.", "backend/.env");
    }
    if (hasValue(backendValues, "COMPOSIO_API_KEY") && !hasValue(backendValues, "COMPOSIO_ALLOWED_ACTIONS_JSON")) {
      add(
        report,
        isProductionProfile ? "error" : "warning",
        "missing-composio-allowed-actions",
        "Connected Apps denies execution until COMPOSIO_ALLOWED_ACTIONS_JSON classifies exact read and write actions.",
        "backend/.env",
      );
    }

    if (isProductionProfile && !hasValue(backendValues, "DATABASE_URL")) {
      add(report, "error", "missing-production-database-url", "DATABASE_URL is required for production persistence with backend/langgraph.production.json.", "backend/.env");
    } else if (!hasValue(backendValues, "DATABASE_URL") && !hasValue(backendValues, "SUPABASE_DB_PASSWORD")) {
      add(report, "warning", "no-persistent-database", "No DATABASE_URL or SUPABASE_DB_PASSWORD found. Local development can run, but thread history may not persist after backend restarts.", "backend/.env");
    }
  }

  if (frontend.exists) {
    if (profile === "production-railway-vercel" && !hasValue(frontendValues, "ANONYMOUS_SESSION_SECRET")) {
      add(report, "error", "missing-frontend-anonymous-session-secret", "Production guest mode requires ANONYMOUS_SESSION_SECRET in frontend/.env.local so the server can issue isolated guest sessions.", "frontend/.env.local");
    }
    if (isProductionProfile && !hasValue(frontendValues, "RATE_LIMIT_REDIS_URL")) {
      add(report, "error", "missing-frontend-rate-limit-redis", "Production image routes require server-only RATE_LIMIT_REDIS_URL in Vercel.", "frontend/.env.local");
    }
    if (
      isProductionProfile &&
      Number.parseInt(frontendValues.TRUSTED_PROXY_HOPS || "0", 10) < 1
    ) {
      add(report, "error", "missing-trusted-proxy-hops", "Production outside Vercel requires TRUSTED_PROXY_HOPS to match the number of proxies that strip and replace forwarding headers.", "frontend/.env.local");
    }
    if (
      hasValue(backendValues, "RATE_LIMIT_REDIS_URL") &&
      hasValue(frontendValues, "RATE_LIMIT_REDIS_URL") &&
      backendValues.RATE_LIMIT_REDIS_URL !== frontendValues.RATE_LIMIT_REDIS_URL
    ) {
      add(report, "error", "rate-limit-redis-mismatch", "Backend and frontend server routes must use the same RATE_LIMIT_REDIS_URL.", "backend/.env");
    }
    if (
      backend.exists &&
      hasValue(backendValues, "ANONYMOUS_SESSION_SECRET") &&
      hasValue(frontendValues, "ANONYMOUS_SESSION_SECRET") &&
      backendValues.ANONYMOUS_SESSION_SECRET !== frontendValues.ANONYMOUS_SESSION_SECRET
    ) {
      add(report, "error", "anonymous-session-secret-mismatch", "ANONYMOUS_SESSION_SECRET must be identical in backend/.env and frontend/.env.local.", "backend/.env");
    }
    for (const key of SERVER_ONLY_KEYS) {
      const publicKey = `NEXT_PUBLIC_${key}`;
      if (hasValue(frontendValues, publicKey) && !ALLOWED_PUBLIC_PROVIDER_KEYS.has(publicKey)) {
        add(report, "error", "server-secret-in-frontend", `${publicKey} would expose a server-side secret to the browser. Use ${key} without NEXT_PUBLIC_ for Next.js server routes.`, "frontend/.env.local");
      }
    }

    for (const key of PUBLIC_FRONTEND_KEYS) {
      if (key.endsWith("_API_KEY") && hasValue(frontendValues, key)) {
        add(report, "warning", "public-api-key", `${key} is exposed to the browser bundle. Use restricted keys or a backend proxy for production.`, "frontend/.env.local");
      }
    }

    const hasSupabaseUrl = hasValue(frontendValues, "NEXT_PUBLIC_SUPABASE_URL");
    const hasSupabaseAnon = hasValue(frontendValues, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
    if (hasSupabaseUrl !== hasSupabaseAnon) {
      add(report, "warning", "partial-frontend-supabase", "Frontend Supabase usually needs both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.", "frontend/.env.local");
    }

    const hasGeminiImageKey = hasValue(frontendValues, "GEMINI_IMAGE_API_KEY")
      || hasValue(frontendValues, "GEMINI_API_KEY");
    if (hasValue(frontendValues, "GEMINI_IMAGE_MODEL") && !hasGeminiImageKey) {
      add(report, "warning", "partial-gemini-image-config", "Nano Banana 2 needs GEMINI_IMAGE_API_KEY or GEMINI_API_KEY when GEMINI_IMAGE_MODEL is configured.", "frontend/.env.local");
    }

    if (hasValue(frontendValues, "OPENAI_IMAGE_MODEL") && !hasValue(frontendValues, "OPENAI_API_KEY")) {
      add(report, "warning", "partial-openai-image-config", "GPT Image 2 needs OPENAI_API_KEY when OPENAI_IMAGE_MODEL is configured.", "frontend/.env.local");
    }
  }

  report.ok = !report.items.some((item) => item.level === "error");
  return report;
}

export function formatReport(report) {
  if (report.items.length === 0) {
    return "OK: Neloo environment configuration looks complete for the checked files.";
  }
  const lines = [];
  for (const item of report.items) {
    const label = item.level === "error" ? "ERROR" : "WARN";
    lines.push(`${label} [${item.code}]${item.file ? ` ${item.file}:` : ":"} ${item.message}`);
  }
  lines.push(report.ok ? "Result: usable with warnings." : "Result: fix errors before running Neloo.");
  return lines.join("\n");
}

function parseArgs(argv) {
  const args = { root: process.cwd(), json: false, profile: "local-minimal" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      args.root = argv[++i] || args.root;
    } else if (arg === "--profile") {
      args.profile = argv[++i] || args.profile;
    } else if (arg === "--json") {
      args.json = true;
    }
  }
  return args;
}

export function checkRoot(root, profile = "local-minimal") {
  const backend = readEnvFile(path.join(root, "backend/.env"));
  const frontend = readEnvFile(path.join(root, "frontend/.env.local"));
  return analyzeEnvironment({ backend, frontend, profile });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = checkRoot(path.resolve(args.root), args.profile);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReport(report));
  }
  process.exitCode = report.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
