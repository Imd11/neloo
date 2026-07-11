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
const rootDockerignore = read(".dockerignore");
const backendDockerignore = read("backend/.dockerignore");

requireIncludes("Dockerfile", rootDockerfile, [
  "langgraph.production.json",
  "${PORT:-8000}",
  "0.0.0.0",
]);
requireNotIncludes("Dockerfile", rootDockerfile, ['"--port", "8000"']);

requireIncludes("backend/Dockerfile", backendDockerfile, [
  "langgraph.production.json",
  "${PORT:-8000}",
  "0.0.0.0",
]);
requireNotIncludes("backend/Dockerfile", backendDockerfile, ['"--port", "8000"']);

const requiredRootDockerignorePatterns = [
  ".env",
  ".env.*",
  ".vercel",
  ".next",
  "node_modules",
  "__pycache__",
  ".pytest_cache",
  ".git",
];

requireIncludes(".dockerignore", rootDockerignore, requiredRootDockerignorePatterns);
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
