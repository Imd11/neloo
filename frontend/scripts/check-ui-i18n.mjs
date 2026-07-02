#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../src", import.meta.url).pathname;
const chineseRegex = /[\u4e00-\u9fff]/;

const excludedPathParts = [
  "/locales/",
  "/app/resume/",
  "/app/slides/",
  "/app/components/slides/",
  "/app/components/canvas/",
  "/app/components/resume/",
  "/app/components/chat/",
  "/app/image/",
  "/app/share/",
  "/app/terms/",
  "/app/privacy/",
  "/app/settings/page.tsx",
  "/app/components/slides/slidecraft/data/",
  "/app/components/slides/slidecraft/services/",
];

const allowedFiles = new Set([
  "providers/LanguageProvider.tsx",
  "data/fortuneTemplatePrefix.ts",
  "app/components/AgentDialog.tsx",
  "app/components/ScheduleDialog.tsx",
  "app/components/TranslatePanel.tsx",
  "app/components/WaterDropletMascot.tsx",
  "app/components/RotatingHeadline.tsx",
  "app/components/UserProfileDialog.tsx",
  "app/components/ImageConfigBar.tsx",
  "app/hooks/useChat.ts",
  "app/hooks/useTriggers.ts",
  "app/hooks/useGoogleDrivePicker.ts",
  "app/hooks/useThreads.ts",
  "lib/config.ts",
  "lib/models.ts",
  "lib/services/image-editor.ts",
  "lib/services/image-generator.ts",
]);

const extensions = new Set([".ts", ".tsx"]);
const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const rel = relative(root, fullPath);
    const normalized = `/${rel.replaceAll("\\", "/")}`;
    const ext = fullPath.slice(fullPath.lastIndexOf("."));
    if (!extensions.has(ext)) continue;
    if (allowedFiles.has(rel.replaceAll("\\", "/"))) continue;
    if (excludedPathParts.some((part) => normalized.includes(part))) continue;

    const content = readFileSync(fullPath, "utf8");
    const lines = content.split("\n");
    lines.forEach((line, index) => {
      if (chineseRegex.test(line)) {
        violations.push(`${rel}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

walk(root);

if (violations.length > 0) {
  console.error(`Found ${violations.length} possible hard-coded Chinese UI strings:\n`);
  console.error(violations.slice(0, 200).join("\n"));
  if (violations.length > 200) {
    console.error(`\n...and ${violations.length - 200} more`);
  }
  process.exit(1);
}

console.log("No hard-coded Chinese UI strings found in scanned files.");
