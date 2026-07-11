#!/usr/bin/env node
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnvContent } from "./check-env.mjs";

const PROFILES = {
  "local-minimal": {
    backend: {
      PORT: "2024",
      API_BASE_URL: "http://localhost:2024",
      FRONTEND_URL: "http://localhost:3000",
      CORS_ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:3001",
      LANGGRAPH_API_URL: "http://localhost:2024",
      LANGGRAPH_DEFAULT_GRAPH_ID: "data_analyst",
      SANDBOX_MODE: "local",
      FILE_USE_LOCAL_STORAGE: "true",
      IMAGE_USE_LOCAL_STORAGE: "true",
      ALLOW_ANONYMOUS: "true",
      ALLOW_INSECURE_LOCAL_TOKENS: "true",
      ALLOW_LOCAL_SANDBOX: "true",
      RATE_LIMIT_NAMESPACE: "neloo",
      TRUSTED_PROXY_HOPS: "0",
    },
    frontend: {
      NEXT_PUBLIC_API_URL: "http://localhost:2024",
      NEXT_PUBLIC_ASSISTANT_ID: "data_analyst",
      RATE_LIMIT_NAMESPACE: "neloo",
      TRUSTED_PROXY_HOPS: "0",
    },
  },
  "local-full": {
    backend: {
      PORT: "2024",
      API_BASE_URL: "http://localhost:2024",
      FRONTEND_URL: "http://localhost:3000",
      CORS_ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:3001",
      LANGGRAPH_API_URL: "http://localhost:2024",
      LANGGRAPH_DEFAULT_GRAPH_ID: "data_analyst",
      SANDBOX_MODE: "local",
      FILE_USE_LOCAL_STORAGE: "true",
      IMAGE_USE_LOCAL_STORAGE: "true",
      ALLOW_ANONYMOUS: "true",
      ALLOW_INSECURE_LOCAL_TOKENS: "true",
      ALLOW_LOCAL_SANDBOX: "true",
      LANGSMITH_TRACING_V2: "false",
      LANGSMITH_PROJECT: "neloo",
      RATE_LIMIT_NAMESPACE: "neloo",
      TRUSTED_PROXY_HOPS: "0",
    },
    frontend: {
      NEXT_PUBLIC_API_URL: "http://localhost:2024",
      NEXT_PUBLIC_ASSISTANT_ID: "data_analyst",
      NEXT_PUBLIC_BACKEND_URL: "http://localhost:2024",
      RATE_LIMIT_NAMESPACE: "neloo",
      TRUSTED_PROXY_HOPS: "0",
    },
  },
  "production-railway-vercel": {
    backend: {
      LANGGRAPH_DEFAULT_GRAPH_ID: "data_analyst",
      SANDBOX_MODE: "e2b",
      FILE_USE_LOCAL_STORAGE: "false",
      IMAGE_USE_LOCAL_STORAGE: "false",
      ALLOW_ANONYMOUS: "true",
      ALLOW_INSECURE_LOCAL_TOKENS: "false",
      LANGSMITH_TRACING_V2: "false",
      LANGSMITH_PROJECT: "neloo",
      RATE_LIMIT_NAMESPACE: "neloo",
      TRUSTED_PROXY_HOPS: "1",
    },
    frontend: {
      NEXT_PUBLIC_ASSISTANT_ID: "data_analyst",
      RATE_LIMIT_NAMESPACE: "neloo",
      TRUSTED_PROXY_HOPS: "1",
    },
  },
};

export function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    profile: "local-minimal",
    dryRun: false,
    force: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      args.root = argv[++i] || args.root;
    } else if (arg === "--profile") {
      args.profile = argv[++i] || args.profile;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

export function updateEnvContent(existingContent, updates, { force = false } = {}) {
  const existing = parseEnvContent(existingContent);
  const lines = existingContent.split(/\r?\n/);
  const changed = [];
  const updateKeys = Object.keys(updates);

  for (const key of updateKeys) {
    if (!force && existing[key] && existing[key].trim()) continue;
    let found = false;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.trim().startsWith("#") || !line.includes("=")) continue;
      const currentKey = line.slice(0, line.indexOf("=")).trim();
      if (currentKey === key) {
        lines[i] = `${key}=${updates[key]}`;
        found = true;
        changed.push(key);
        break;
      }
    }
    if (!found) {
      if (lines.length && lines[lines.length - 1].trim() !== "") lines.push("");
      lines.push(`${key}=${updates[key]}`);
      changed.push(key);
    }
  }

  return {
    content: lines.join("\n").replace(/\n*$/, "\n"),
    changed,
  };
}

function ensureFromExample({ examplePath, targetPath, dryRun }) {
  if (fs.existsSync(targetPath)) {
    return { created: false, message: `Exists: ${path.relative(process.cwd(), targetPath)}` };
  }
  if (!fs.existsSync(examplePath)) {
    throw new Error(`Missing template: ${examplePath}`);
  }
  if (!dryRun) {
    fs.copyFileSync(examplePath, targetPath);
  }
  return { created: true, message: `Created: ${path.relative(process.cwd(), targetPath)}` };
}

export function setupEnvironment({ root, profile, dryRun = false, force = false }) {
  const selected = PROFILES[profile];
  if (!selected) {
    throw new Error(`Unknown profile "${profile}". Choose one of: ${Object.keys(PROFILES).join(", ")}`);
  }

  const resolvedRoot = path.resolve(root);
  const files = {
    backendExample: path.join(resolvedRoot, "backend/.env.example"),
    backendEnv: path.join(resolvedRoot, "backend/.env"),
    frontendExample: path.join(resolvedRoot, "frontend/.env.example"),
    frontendEnv: path.join(resolvedRoot, "frontend/.env.local"),
  };

  const messages = [];
  messages.push(ensureFromExample({
    examplePath: files.backendExample,
    targetPath: files.backendEnv,
    dryRun,
  }).message);
  messages.push(ensureFromExample({
    examplePath: files.frontendExample,
    targetPath: files.frontendEnv,
    dryRun,
  }).message);

  const backendContent = fs.existsSync(files.backendEnv)
    ? fs.readFileSync(files.backendEnv, "utf8")
    : fs.readFileSync(files.backendExample, "utf8");
  const frontendContent = fs.existsSync(files.frontendEnv)
    ? fs.readFileSync(files.frontendEnv, "utf8")
    : fs.readFileSync(files.frontendExample, "utf8");

  const backendValues = parseEnvContent(backendContent);
  const frontendValues = parseEnvContent(frontendContent);
  const anonymousSessionSecret = backendValues.ANONYMOUS_SESSION_SECRET
    || frontendValues.ANONYMOUS_SESSION_SECRET
    || randomBytes(32).toString("hex");
  const rateLimitRedisUrl = backendValues.RATE_LIMIT_REDIS_URL
    || frontendValues.RATE_LIMIT_REDIS_URL
    || "";
  const backendUpdate = updateEnvContent(
    backendContent,
    {
      ...selected.backend,
      ANONYMOUS_SESSION_SECRET: anonymousSessionSecret,
      RATE_LIMIT_REDIS_URL: rateLimitRedisUrl,
    },
    { force }
  );
  const frontendUpdate = updateEnvContent(
    frontendContent,
    {
      ...selected.frontend,
      ANONYMOUS_SESSION_SECRET: anonymousSessionSecret,
      RATE_LIMIT_REDIS_URL: rateLimitRedisUrl,
    },
    { force }
  );

  if (!dryRun) {
    fs.writeFileSync(files.backendEnv, backendUpdate.content);
    fs.writeFileSync(files.frontendEnv, frontendUpdate.content);
  }

  messages.push(`Profile: ${profile}`);
  messages.push(`Backend values ${dryRun ? "would change" : "changed"}: ${backendUpdate.changed.length ? backendUpdate.changed.join(", ") : "none"}`);
  messages.push(`Frontend values ${dryRun ? "would change" : "changed"}: ${frontendUpdate.changed.length ? frontendUpdate.changed.join(", ") : "none"}`);
  messages.push("Next steps:");
  messages.push("1. Add at least one backend chat model key in backend/.env.");
  messages.push(`2. Run \`node neloo-configurator/scripts/check-env.mjs --profile ${profile}\`.`);
  messages.push("3. Start backend and frontend only after check-env errors are resolved.");

  if (profile === "production-railway-vercel") {
    messages.push("Production reminder: fill API_BASE_URL, FRONTEND_URL, CORS_ALLOWED_ORIGINS, DATABASE_URL, RATE_LIMIT_REDIS_URL, E2B_API_KEY, FILE_SECRET_KEY, IMAGE_SECRET_KEY, and provider keys in Railway/Vercel dashboards.");
  } else {
    messages.push("Backend: `cd backend && langgraph dev --host 127.0.0.1 --port 2024`");
    messages.push("Frontend: `cd frontend && yarn dev`");
  }

  return { profile, dryRun, force, messages };
}

function printHelp() {
  console.log(`Usage: node neloo-configurator/scripts/setup-env.mjs [options]

Options:
  --root <path>       Repository root. Defaults to current directory.
  --profile <name>    local-minimal, local-full, production-railway-vercel.
  --dry-run           Show changes without writing files.
  --force             Overwrite existing non-empty values.
  --help              Show this help.
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = setupEnvironment(args);
    console.log(result.messages.join("\n"));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
