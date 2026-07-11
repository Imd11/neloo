#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const canonicalDir = resolve(root, "supabase/migrations");
const requiredTables = [
  "threads",
  "files",
  "thread_files",
  "upload_sessions",
  "chat_messages",
  "thread_seq",
  "shared_conversations",
  "agents",
  "scheduled_triggers",
  "trigger_execution_logs",
  "user_profiles",
  "slide_presentations",
  "user_integrations",
  "integration_action_logs",
];

const errors = [];
const migrationFiles = readdirSync(canonicalDir).filter((file) => file.endsWith(".sql"));
const versions = new Map();
for (const file of migrationFiles) {
  const version = file.split("_", 1)[0];
  const previous = versions.get(version);
  if (previous) {
    errors.push(`duplicate migration version ${version}: ${previous}, ${file}`);
  } else {
    versions.set(version, file);
  }
}
const baselineName = "20260712090000_canonical_schema.sql";
if (!migrationFiles.includes(baselineName)) {
  errors.push(`missing canonical baseline: supabase/migrations/${baselineName}`);
} else {
  const sql = readFileSync(resolve(canonicalDir, baselineName), "utf8").toLowerCase();
  for (const table of requiredTables) {
    if (!new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+(public\\.)?${table}\\b`).test(sql)) {
      errors.push(`canonical baseline does not create ${table}`);
    }
  }
}

for (const document of ["README.md", "docs/configuration.md", ".github/workflows/ci.yml"]) {
  const path = resolve(root, document);
  let content = "";
  try {
    content = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  if (/backend\/(supabase\/)?migrations\//.test(content)) {
    errors.push(`${document} still presents a legacy migration directory as executable`);
  }
}

for (const legacyDir of ["backend/migrations", "backend/supabase/migrations"]) {
  const files = readdirSync(resolve(root, legacyDir)).filter((file) => file.endsWith(".sql"));
  if (files.some((file) => file.startsWith("20260712"))) {
    errors.push(`${legacyDir} contains a new migration; use supabase/migrations only`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Canonical migration layout OK (${migrationFiles.length} migrations).`);
