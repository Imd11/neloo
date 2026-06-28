import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const checker = path.join(repoRoot, "scripts/check-docker-release-readiness.mjs");

test("docker release readiness checker passes for the repository", () => {
  const result = spawnSync(process.execPath, [checker], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(
    result.status,
    0,
    `Expected checker to pass.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
  );
});
