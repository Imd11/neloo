# UI Localization Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the main Neloo product UI respect the selected language so English mode no longer shows Chinese product chrome, while preserving user content, model names, file names, and AI responses exactly as authored.

**Architecture:** Keep the existing `LanguageProvider` and JSON locale files as the short-term i18n architecture. Add missing translation namespaces, replace hard-coded UI strings module by module, and add an audit script that detects remaining Chinese literals in user-facing application code. Do not migrate to route-based `next-intl` in this plan; that would be a separate architecture migration.

**Tech Stack:** Next.js 16, React 19, TypeScript, custom `LanguageProvider`, JSON locale files, ESLint, TypeScript compiler.

---

## Scope Rules

Localize product UI only:
- Translate navigation, settings, placeholders, empty states, toasts, dialogs, aria labels, tooltips, and status labels.
- Do not translate user-entered messages, AI responses, uploaded file names, generated thread titles, model names, provider names, or app/brand names.
- Do not localize prompt templates, model prompts, slide style definitions, resume parsing prompts, or seed data in this pass unless they are directly rendered as product UI.

Target languages:
- `zh-CN`
- `zh-TW`
- `en`
- `ja`

---

### Task 1: Add A Chinese-Literal Audit Script

**Files:**
- Create: `/Users/yang/Desktop/agent/neloo/frontend/scripts/check-ui-i18n.mjs`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/package.json`

**Step 1: Write the failing audit script**

Create a Node script that scans `frontend/src` for Chinese characters in likely user-facing code while excluding known non-UI sources.

```js
#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../src", import.meta.url).pathname;
const chineseRegex = /[\u4e00-\u9fff]/;

const excludedPathParts = [
  "/locales/",
  "/data/",
  "/app/resume/lib/",
  "/app/resume/templates/",
  "/app/components/slides/slidecraft/data/",
  "/app/components/slides/slidecraft/services/",
];

const allowedFiles = new Set([
  "providers/LanguageProvider.tsx",
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
```

**Step 2: Add a package script**

Modify `frontend/package.json`:

```json
{
  "scripts": {
    "i18n:audit": "node scripts/check-ui-i18n.mjs"
  }
}
```

Preserve the existing scripts and only add the new key.

**Step 3: Run the audit and confirm it fails**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin yarn i18n:audit
```

Expected: FAIL. It should list current hard-coded Chinese strings in files such as `AppSidebar.tsx`, `ChatPromptInput.tsx`, `TopBar.tsx`, and `ThinkingBlock.tsx`.

**Step 4: Commit**

```bash
cd /Users/yang/Desktop/agent/neloo
git add frontend/scripts/check-ui-i18n.mjs frontend/package.json
git commit -m "test: add ui localization audit"
```

---

### Task 2: Expand Locale Dictionaries For Main Product Shell

**Files:**
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/locales/en.json`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/locales/zh-CN.json`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/locales/zh-TW.json`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/locales/ja.json`

**Step 1: Add namespaces and keys**

Add these namespaces to all four locale files. Keep existing `common`, `settings`, and `canvas` keys intact.

Required key structure:

```json
{
  "sidebar": {
    "new_chat": "...",
    "search": "...",
    "agents": "...",
    "library": "...",
    "history": "...",
    "open_sidebar": "...",
    "settings": "...",
    "share": "...",
    "rename": "...",
    "pin": "...",
    "unpin": "...",
    "delete": "...",
    "delete_title": "...",
    "delete_description": "...",
    "share_title": "...",
    "share_description": "...",
    "copy": "...",
    "copied": "...",
    "rename_prompt": "...",
    "rename_success": "...",
    "rename_failed": "...",
    "delete_success": "...",
    "delete_failed": "...",
    "share_failed": "...",
    "share_login_required": "...",
    "share_create_failed": "...",
    "try_again_later": "..."
  },
  "chat": {
    "default_placeholder": "...",
    "webdev_placeholder": "...",
    "continue_placeholder": "...",
    "webdev_mode": "...",
    "clear_selected_feature": "...",
    "add_from_google_drive": "...",
    "choose_from_library": "...",
    "add_local_file": "...",
    "uploaded_file": "...",
    "follow_up_suggestions": "...",
    "copy": "...",
    "regenerate": "...",
    "share": "..."
  },
  "thinking": {
    "thinking": "...",
    "duration": "...",
    "content": "...",
    "redacted": "...",
    "searching": "..."
  },
  "model_selector": {
    "search_placeholder": "...",
    "not_configured": "...",
    "quota": "..."
  },
  "settings": {
    "connected_apps": "...",
    "connected_apps_desc": "...",
    "search_apps": "...",
    "category": "...",
    "all_categories": "...",
    "my_apps": "...",
    "connected_count": "...",
    "marketplace": "...",
    "available_count": "...",
    "no_connected_apps": "...",
    "no_matching_connected_apps": "...",
    "no_matching_apps": "...",
    "login_required": "...",
    "connect_success": "...",
    "connect_failed": "...",
    "disconnect_success": "...",
    "disconnect_failed": "...",
    "manage_app": "..."
  }
}
```

Use natural product copy, not literal word-for-word machine translation. Keep placeholders such as `{name}` and `{count}` consistent across all languages.

**Step 2: Validate JSON**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin node -e 'for (const f of ["src/locales/en.json","src/locales/zh-CN.json","src/locales/zh-TW.json","src/locales/ja.json"]) { JSON.parse(require("fs").readFileSync(f, "utf8")); console.log("ok", f); }'
```

Expected: all four files print `ok`.

**Step 3: Commit**

```bash
cd /Users/yang/Desktop/agent/neloo
git add frontend/src/locales/en.json frontend/src/locales/zh-CN.json frontend/src/locales/zh-TW.json frontend/src/locales/ja.json
git commit -m "feat: add main ui localization keys"
```

---

### Task 3: Localize `AppSidebar`

**Files:**
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/AppSidebar.tsx`

**Step 1: Make nav labels translation-aware**

Import `useLanguage`:

```ts
import { useLanguage } from "@/providers/LanguageProvider";
```

Move `navItems` inside `AppSidebar` after `const { t } = useLanguage();` so it can use translated labels.

```ts
const { t } = useLanguage();

const navItems = [
  { icon: MessageSquarePlus, label: t("sidebar.new_chat"), path: "/", action: "new" },
  { icon: Search, label: t("sidebar.search"), path: null, action: "search" },
  { icon: Bot, label: t("sidebar.agents"), path: null, action: "agent" },
  { icon: FolderOpen, label: t("sidebar.library"), path: null, action: "library" },
] as const;
```

Adjust `handleNavClick` typing if needed:

```ts
const handleNavClick = (item: (typeof navItems)[number]) => {
  // existing logic
};
```

**Step 2: Replace hard-coded sidebar strings**

Replace:
- `历史任务` -> `t("sidebar.history")`
- `打开边栏` -> `t("sidebar.open_sidebar")`
- `设置` -> `t("sidebar.settings")`
- `分享` -> `t("sidebar.share")`
- `重命名` -> `t("sidebar.rename")`
- `置顶` -> `t("sidebar.pin")`
- `取消置顶` -> `t("sidebar.unpin")`
- `删除` -> `t("sidebar.delete")`
- `确认删除` -> `t("sidebar.delete_title")`
- `确定要删除「{title}」吗？此操作无法撤销。` -> `t("sidebar.delete_description", { title: itemToDelete?.title ?? "" })`
- `分享对话` -> `t("sidebar.share_title")`
- `任何人都可以通过此链接查看整个对话` -> `t("sidebar.share_description")`
- `复制` -> `t("sidebar.copy")`
- `关闭` -> `t("common.close")`

**Step 3: Replace toasts and prompts**

Replace:
- `prompt("请输入新标题", currentTitle)` -> `prompt(t("sidebar.rename_prompt"), currentTitle)`
- `toast.success("已重命名")` -> `toast.success(t("sidebar.rename_success"))`
- `toast.error("重命名失败")` -> `toast.error(t("sidebar.rename_failed"))`
- `toast.success("已删除")` -> `toast.success(t("sidebar.delete_success"))`
- `toast.error("删除失败")` -> `toast.error(t("sidebar.delete_failed"))`
- `toast.error("无法分享", { description: "请先登录" })` -> translated keys
- `toast.success("已复制到剪贴板")` -> `toast.success(t("sidebar.copied"))`

**Step 4: Run checks**

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin ./node_modules/.bin/eslint src/app/components/AppSidebar.tsx
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin ./node_modules/.bin/tsc --noEmit
```

Expected: no errors.

**Step 5: Commit**

```bash
cd /Users/yang/Desktop/agent/neloo
git add frontend/src/app/components/AppSidebar.tsx
git commit -m "feat: localize sidebar ui"
```

---

### Task 4: Localize Chat Input And Main Chat Shell Strings

**Files:**
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/ChatPromptInput.tsx`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/page.tsx`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/HierarchicalTaskView.tsx`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/ChatMessage.tsx`

**Step 1: Localize `ChatPromptInput` defaults**

Import `useLanguage`:

```ts
import { useLanguage } from "@/providers/LanguageProvider";
```

Inside the component:

```ts
const { t } = useLanguage();
```

Change default placeholder behavior:

```ts
placeholder,
```

Then:

```ts
const effectivePlaceholder = selectedFeature?.placeholder
  || (webDevMode ? t("chat.webdev_placeholder") : placeholder ?? t("chat.default_placeholder"));
```

Replace:
- `网页开发` -> `t("chat.webdev_mode")`
- `清除已选功能` -> `t("chat.clear_selected_feature")`
- `从 Google Drive 文件中添加` -> `t("chat.add_from_google_drive")`
- `从库中选择` -> `t("chat.choose_from_library")`
- `从本地文件中添加` -> `t("chat.add_local_file")`

**Step 2: Remove hard-coded placeholders passed from `page.tsx`**

In `/Users/yang/Desktop/agent/neloo/frontend/src/app/page.tsx`, replace hard-coded `placeholder="描述你想要创建的内容..."` with a translated value by using `useLanguage()` in the component that renders `ChatPromptInput`.

```tsx
const { t } = useLanguage();

<ChatPromptInput placeholder={t("chat.default_placeholder")} />
```

If a wrapper component already passes the placeholder, localize at the highest owner that knows the page mode.

**Step 3: Localize action tooltips and suggestion labels**

In `HierarchicalTaskView.tsx` and `ChatMessage.tsx`, replace:
- `复制` -> `t("chat.copy")`
- `重新生成` -> `t("chat.regenerate")`
- `分享` / `分享对话` -> `t("chat.share")`
- `你可能想继续问：` -> `t("chat.follow_up_suggestions")`

**Step 4: Run checks**

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin ./node_modules/.bin/eslint src/app/components/ChatPromptInput.tsx src/app/page.tsx src/app/components/HierarchicalTaskView.tsx src/app/components/ChatMessage.tsx
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin ./node_modules/.bin/tsc --noEmit
```

Expected: no errors.

**Step 5: Commit**

```bash
cd /Users/yang/Desktop/agent/neloo
git add frontend/src/app/components/ChatPromptInput.tsx frontend/src/app/page.tsx frontend/src/app/components/HierarchicalTaskView.tsx frontend/src/app/components/ChatMessage.tsx
git commit -m "feat: localize chat shell ui"
```

---

### Task 5: Localize Model Selector And Top Bar

**Files:**
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/layout/TopBar.tsx`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/ModelSelector.tsx`

**Step 1: Add translations to `TopBar`**

Import and use language context:

```ts
import { useLanguage } from "@/providers/LanguageProvider";
```

Inside `TopBar`:

```ts
const { t } = useLanguage();
```

Replace:
- `placeholder="搜索模型..."` -> `placeholder={t("model_selector.search_placeholder")}`
- `未配置` -> `t("model_selector.not_configured")`
- `额度` -> `t("model_selector.quota")`

Do not translate `currentModel.name`, provider names, or backend model names.

**Step 2: Add translations to `ModelSelector`**

Apply the same keys to `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/ModelSelector.tsx`.

Replace:
- `No models available` only if it is user-facing in current app shell; add `model_selector.no_models` if needed.
- `未配置` -> `t("model_selector.not_configured")`

**Step 3: Run checks**

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin ./node_modules/.bin/eslint src/app/components/layout/TopBar.tsx src/app/components/ModelSelector.tsx
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin ./node_modules/.bin/tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
cd /Users/yang/Desktop/agent/neloo
git add frontend/src/app/components/layout/TopBar.tsx frontend/src/app/components/ModelSelector.tsx
git commit -m "feat: localize model selector ui"
```

---

### Task 6: Localize Thinking And Agentic Status UI

**Files:**
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/ui/agentic/ThinkingBlock.tsx`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/ThinkingBlock.tsx`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/ui/agentic/ToolStep.tsx`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/SubAgentIndicator.tsx`

**Step 1: Localize the active thinking component**

In `ui/agentic/ThinkingBlock.tsx`, replace:

```ts
const statusLabel = isStreaming ? "正在思考" : shouldShowTimer ? "思考用时" : "思考过程";
```

with:

```ts
const { t } = useLanguage();
const statusLabel = isStreaming
  ? t("thinking.thinking")
  : shouldShowTimer
    ? t("thinking.duration")
    : t("thinking.content");
```

Replace `思考过程已隐藏` with `t("thinking.redacted")`.

**Step 2: Localize legacy `ThinkingBlock`**

In `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/ThinkingBlock.tsx`, apply the same translation keys for:
- `正在思考`
- `思考已完成`
- `思考过程已隐藏`

**Step 3: Localize tool status labels**

In `ToolStep.tsx`, replace labels such as `正在搜索` with keys under `thinking.searching` or a new `tools.searching` namespace if more tool labels exist.

**Step 4: Localize sub-agent status labels**

In `SubAgentIndicator.tsx`, replace:
- `等待中`
- `执行中`
- `已完成`
- `失败`
- `未知`

Add `sub_agent` locale keys if needed.

**Step 5: Run checks**

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin ./node_modules/.bin/eslint src/app/components/ui/agentic/ThinkingBlock.tsx src/app/components/ThinkingBlock.tsx src/app/components/ui/agentic/ToolStep.tsx src/app/components/SubAgentIndicator.tsx
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin ./node_modules/.bin/tsc --noEmit
```

Expected: no errors.

**Step 6: Commit**

```bash
cd /Users/yang/Desktop/agent/neloo
git add frontend/src/app/components/ui/agentic/ThinkingBlock.tsx frontend/src/app/components/ThinkingBlock.tsx frontend/src/app/components/ui/agentic/ToolStep.tsx frontend/src/app/components/SubAgentIndicator.tsx frontend/src/locales/*.json
git commit -m "feat: localize thinking status ui"
```

---

### Task 7: Complete Settings Dialog Localization

**Files:**
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/SettingsDialog.tsx`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/settings/ConnectedAppsTab.tsx`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/settings/AppCard.tsx`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/settings/appsData.ts`

**Step 1: Replace the remaining hard-coded settings tab label**

In `SettingsDialog.tsx`:

```ts
{ id: "connected-apps", label: t("settings.connected_apps"), icon: Plug }
```

**Step 2: Localize `ConnectedAppsTab`**

Import `useLanguage` and replace:
- `连接应用`
- `连接第三方应用以扩展功能和提升工作效率`
- `搜索应用...`
- `分类`
- `全部分类`
- `我的应用`
- `应用市场`
- `没有找到匹配的已连接应用`
- `还没有连接任何应用`
- `没有找到匹配的应用`
- success/error toast messages

Use parameterized translations for counts:

```tsx
{t("settings.connected_count", { count: connectedApps.length })}
{t("settings.available_count", { count: marketplaceApps.length })}
```

**Step 3: Audit `AppCard` and `appsData`**

If app descriptions/categories in `appsData.ts` are rendered as product UI, either:
- keep app names as source data but localize descriptions via translation keys, or
- add an explicit exception to the audit script if they are treated as marketplace seed content.

Prefer translation keys for visible descriptions.

**Step 4: Run checks**

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin ./node_modules/.bin/eslint src/app/components/SettingsDialog.tsx src/app/components/settings/ConnectedAppsTab.tsx src/app/components/settings/AppCard.tsx src/app/components/settings/appsData.ts
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin ./node_modules/.bin/tsc --noEmit
```

Expected: no errors.

**Step 5: Commit**

```bash
cd /Users/yang/Desktop/agent/neloo
git add frontend/src/app/components/SettingsDialog.tsx frontend/src/app/components/settings/ConnectedAppsTab.tsx frontend/src/app/components/settings/AppCard.tsx frontend/src/app/components/settings/appsData.ts frontend/src/locales/*.json
git commit -m "feat: localize connected apps settings"
```

---

### Task 8: Localize High-Frequency Feedback Components

**Files:**
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/SearchDialog.tsx`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/ThreadList.tsx`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/MessageAttachments.tsx`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/DataFileUpload.tsx`
- Modify: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/LibraryDialog.tsx`

**Step 1: Add missing locale keys**

Add namespaces as needed:
- `search`
- `thread`
- `files`
- `library`

Include keys for placeholders, empty states, delete confirmations, login-required messages, download failures, and upload menu labels.

**Step 2: Replace user-facing literals**

Examples:
- `搜索聊天...` -> `t("search.placeholder")`
- `新建对话` -> `t("sidebar.new_chat")`
- `暂无任务` -> `t("thread.empty")`
- `请先登录` -> `t("common.login_required")` or module-specific key
- `下载失败` -> `t("files.download_failed")`
- `从 Google Drive 文件中添加` -> `t("chat.add_from_google_drive")`

**Step 3: Run targeted checks**

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin ./node_modules/.bin/eslint src/app/components/SearchDialog.tsx src/app/components/ThreadList.tsx src/app/components/MessageAttachments.tsx src/app/components/DataFileUpload.tsx src/app/components/LibraryDialog.tsx
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin ./node_modules/.bin/tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
cd /Users/yang/Desktop/agent/neloo
git add frontend/src/app/components/SearchDialog.tsx frontend/src/app/components/ThreadList.tsx frontend/src/app/components/MessageAttachments.tsx frontend/src/app/components/DataFileUpload.tsx frontend/src/app/components/LibraryDialog.tsx frontend/src/locales/*.json
git commit -m "feat: localize feedback and file ui"
```

---

### Task 9: Run Global Audit And Fix Remaining Main-Shell Leaks

**Files:**
- Modify only files reported by `/Users/yang/Desktop/agent/neloo/frontend/scripts/check-ui-i18n.mjs`
- Modify locale JSON files as needed

**Step 1: Run the audit**

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin yarn i18n:audit
```

Expected: FAIL if remaining main-shell Chinese hard-coded strings exist.

**Step 2: Classify each remaining hit**

For each hit:
- If it is product UI, replace it with `t()`.
- If it is prompt engineering, seed data, user example data, or a non-rendered code comment, add a narrow exclusion or leave it if the script does not scan comments.
- If it is visible but belongs to a lower-priority feature module such as Slides or Resume, decide whether to localize now or create a follow-up plan.

Do not silence the audit broadly. Exclusions must be narrow and justified.

**Step 3: Repeat until pass for main-shell scope**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin yarn i18n:audit
```

Expected: PASS for the defined scan scope.

**Step 4: Run full frontend checks**

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin ./node_modules/.bin/eslint .
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin ./node_modules/.bin/tsc --noEmit
```

Expected: no new errors. If `eslint .` exposes unrelated pre-existing warnings/errors, record them and run targeted lint for changed files.

**Step 5: Commit**

```bash
cd /Users/yang/Desktop/agent/neloo
git add frontend
git commit -m "fix: remove remaining hard-coded main ui chinese"
```

---

### Task 10: Manual UX Verification Across Languages

**Files:**
- No code changes expected. If bugs are found, modify the relevant component and locale file.

**Step 1: Start or confirm the app is running**

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin ./node_modules/.bin/next dev --port 3001
```

Expected: app available at `http://localhost:3001`.

**Step 2: Verify English mode**

In the app:
1. Open Settings.
2. Change Language to English.
3. Close Settings.
4. Check:
   - Sidebar navigation is English.
   - History label is English.
   - Input placeholder is English.
   - Model selector search placeholder is English.
   - Unconfigured model status is English.
   - Thinking status is English.
   - Settings and connected apps are English.
   - Toasts/dialogs triggered by sidebar actions are English.

Expected: no Chinese UI text in the main shell.

**Step 3: Verify Chinese, Traditional Chinese, and Japanese**

Repeat the same smoke path for:
- `zh-CN`
- `zh-TW`
- `ja`

Expected: product chrome changes language correctly without breaking layout.

**Step 4: Verify non-translatable content remains unchanged**

Check:
- Existing user messages remain in their original language.
- AI responses remain in their original language.
- Model names remain `DeepSeek V4 Pro`, `Claude Opus 4.8`, etc.
- Provider names remain brand/provider names.
- File names remain unchanged.
- Historical generated thread titles remain unchanged.

Expected: no user content is rewritten by UI localization.

**Step 5: Final verification commands**

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin yarn i18n:audit
PATH=/Users/yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin:/usr/sbin:/sbin ./node_modules/.bin/tsc --noEmit
```

Expected: both pass.

**Step 6: Commit verification notes if docs changed**

If a localization policy note is added to docs, commit it separately:

```bash
cd /Users/yang/Desktop/agent/neloo
git add docs
git commit -m "docs: document localization policy"
```

---

## Follow-Up Work Not Included In This Plan

- Full localization of Slides, Resume, image generation, agent store, and all generated-template workflows.
- Migration from custom `LanguageProvider` to route-based `next-intl`.
- Server-side locale negotiation and localized SEO metadata.
- Automatic AI response language alignment.

These are deliberately excluded to keep the first implementation focused on the visible main product shell and to avoid changing user content semantics.

