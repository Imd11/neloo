#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync("yarn", ["audit", "--groups", "dependencies", "--json"], {
  cwd: path.join(root, "frontend"),
  encoding: "utf8",
});

const rows = result.stdout
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .filter(Boolean);
const summary = rows.find((row) => row.type === "auditSummary")?.data?.vulnerabilities;
if (!summary) {
  console.error(result.stderr || "Unable to read the production dependency audit");
  process.exit(1);
}

console.log(
  `Production dependency audit: critical=${summary.critical}, high=${summary.high}, moderate=${summary.moderate}, low=${summary.low}`
);
if (summary.moderate > 0) {
  const modules = [...new Set(
    rows
      .filter((row) => row.type === "auditAdvisory" && row.data.advisory.severity === "moderate")
      .map((row) => row.data.advisory.module_name)
  )];
  console.warn(`Moderate advisories to track: ${modules.join(", ")}`);
}
if (summary.critical > 0 || summary.high > 0) process.exit(1);
