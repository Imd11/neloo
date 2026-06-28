import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setupEnvironment, updateEnvContent } from "./setup-env.mjs";

test("updateEnvContent does not overwrite existing values by default", () => {
  const result = updateEnvContent("A=existing\nB=\n", { A: "new", B: "filled", C: "added" });
  assert.match(result.content, /^A=existing/m);
  assert.match(result.content, /^B=filled/m);
  assert.match(result.content, /^C=added/m);
  assert.deepEqual(result.changed, ["B", "C"]);
});

test("updateEnvContent overwrites values when force is true", () => {
  const result = updateEnvContent("A=existing\n", { A: "new" }, { force: true });
  assert.match(result.content, /^A=new/m);
  assert.deepEqual(result.changed, ["A"]);
});

test("setupEnvironment creates env files and prints concrete local next steps", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "neloo-config-test-"));
  fs.mkdirSync(path.join(root, "backend"), { recursive: true });
  fs.mkdirSync(path.join(root, "frontend"), { recursive: true });
  fs.writeFileSync(path.join(root, "backend/.env.example"), "PORT=\nSANDBOX_MODE=\nDEEPSEEK_API_KEY=\n");
  fs.writeFileSync(path.join(root, "frontend/.env.example"), "NEXT_PUBLIC_API_URL=\nNEXT_PUBLIC_ASSISTANT_ID=\n");

  const result = setupEnvironment({ root, profile: "local-minimal" });
  const backend = fs.readFileSync(path.join(root, "backend/.env"), "utf8");
  const frontend = fs.readFileSync(path.join(root, "frontend/.env.local"), "utf8");
  const output = result.messages.join("\n");

  assert.match(output, /Profile: local-minimal/);
  assert.match(output, /Next steps:/);
  assert.match(output, /1\. Add at least one backend chat model key in backend\/\.env\./);
  assert.match(
    output,
    /2\. Run `node neloo-configurator\/scripts\/check-env\.mjs --profile local-minimal`\./
  );
  assert.match(output, /3\. Start backend and frontend only after check-env errors are resolved\./);
  assert.match(output, /Backend: `cd backend && langgraph dev --host 127\.0\.0\.1 --port 2024`/);
  assert.match(output, /Frontend: `cd frontend && yarn dev`/);
  assert.match(backend, /^PORT=2024/m);
  assert.match(backend, /^SANDBOX_MODE=local/m);
  assert.match(frontend, /^NEXT_PUBLIC_API_URL=http:\/\/localhost:2024/m);
});

test("setupEnvironment gives production-specific next steps", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "neloo-config-test-"));
  fs.mkdirSync(path.join(root, "backend"), { recursive: true });
  fs.mkdirSync(path.join(root, "frontend"), { recursive: true });
  fs.writeFileSync(path.join(root, "backend/.env.example"), "SANDBOX_MODE=\nDATABASE_URL=\nE2B_API_KEY=\n");
  fs.writeFileSync(path.join(root, "frontend/.env.example"), "NEXT_PUBLIC_API_URL=\nNEXT_PUBLIC_ASSISTANT_ID=\n");

  const result = setupEnvironment({ root, profile: "production-railway-vercel" });
  const output = result.messages.join("\n");

  assert.match(output, /Profile: production-railway-vercel/);
  assert.match(output, /Next steps:/);
  assert.match(
    output,
    /node neloo-configurator\/scripts\/check-env\.mjs --profile production-railway-vercel/
  );
  assert.match(output, /Railway\/Vercel dashboards/);
  assert.match(output, /DATABASE_URL/);
  assert.doesNotMatch(output, /langgraph dev --host 127\.0\.0\.1 --port 2024/);
});

test("setupEnvironment dry-run does not create files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "neloo-config-test-"));
  fs.mkdirSync(path.join(root, "backend"), { recursive: true });
  fs.mkdirSync(path.join(root, "frontend"), { recursive: true });
  fs.writeFileSync(path.join(root, "backend/.env.example"), "PORT=\n");
  fs.writeFileSync(path.join(root, "frontend/.env.example"), "NEXT_PUBLIC_API_URL=\n");

  setupEnvironment({ root, profile: "local-minimal", dryRun: true });

  assert.equal(fs.existsSync(path.join(root, "backend/.env")), false);
  assert.equal(fs.existsSync(path.join(root, "frontend/.env.local")), false);
});
