import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workflowDir = path.join(root, ".github", "workflows");
const required = ["ci.yml", "pr_lint.yml", "security.yml"];

for (const name of required) {
  if (!fs.existsSync(path.join(workflowDir, name))) {
    console.error(`Missing .github/workflows/${name}`);
    process.exitCode = 1;
  }
}

const nested = path.join(root, "frontend", ".github", "workflows");
if (fs.existsSync(nested) && fs.readdirSync(nested).some((name) => /\.ya?ml$/.test(name))) {
  console.error("Nested frontend workflows are not discovered by GitHub Actions.");
  process.exitCode = 1;
}

for (const name of required) {
  const file = path.join(workflowDir, name);
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  for (const match of content.matchAll(/uses:\s*([^\s#]+)/g)) {
    if (!/@[a-f0-9]{40}$/.test(match[1])) {
      console.error(`${name} uses an action that is not pinned to a commit SHA: ${match[1]}`);
      process.exitCode = 1;
    }
  }
}

if (!process.exitCode) console.log("GitHub workflow layout and action pins are valid.");
