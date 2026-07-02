# Neloo Homepage Feature Actions Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the homepage feature buttons fully usable, remove confusing/unsafe provider configuration, and document the exact configuration path for open-source users.

**Architecture:** Feature buttons should either open a complete dedicated experience or submit a hidden, feature-specific prompt through the selected server-side chat model. Paid provider credentials must stay on the server side: backend chat model keys belong in `backend/.env`, while Next.js image route keys belong in `frontend/.env.local` without `NEXT_PUBLIC_`. Slides generation must use backend APIs for text generation, Next.js server routes for images, and a Supabase/local persistence layer for saved presentations.

**Tech Stack:** Next.js 16, React 19, TypeScript, FastAPI, LangGraph, Supabase, Yarn 1.x, Node test runner, Python `py_compile`.

---

## Execution Rules

- Use `superpowers:executing-plans` and execute one task at a time.
- During code edits, follow `karpathy-guidelines`.
- Before completion, use `superpowers:verification-before-completion`.
- Do not add login gates. Neloo currently supports guest/local usage; every feature should work once the user has configured the required provider variables.
- Do not expose paid provider API keys to browser bundles. Treat every `NEXT_PUBLIC_*` variable as public.
- Do not reintroduce Tu-Zi. Image generation/editing must use Nano Banana or GPT Image 2.
- After all tasks pass verification, push the final branch to GitHub `main`.

## User-Facing Target State

After implementation, a new user sees six homepage actions:

- **AI Image:** opens an image workspace using Nano Banana by default, with GPT Image 2 as an alternative when configured.
- **Slides:** opens a slide creation workspace, uses the selected top-left chat model for slide text, uses the server image route for slide images, and saves presentation history.
- **Prompt Optimize:** submits the user's prompt with an invisible prompt-engineering instruction and returns an optimized prompt.
- **Fortune Telling:** collects required birth/fortune fields before submission and sends the selected template prefix invisibly.
- **Humanize:** submits the user's text with the approved human-writing prompt and returns only rewritten text.
- **AI Translate:** opens a translation panel, lets users choose source language or auto-detect, target language, and style, and uses the selected top-left model through the backend.

Unavailable providers should fail clearly with configuration errors. Users should know exactly which `.env` file to edit.

---

### Task 1: Preflight Scope Check

**Files:**
- Read: `frontend/src/app/page.tsx`
- Read: `frontend/src/app/components/FeatureButtons.tsx`
- Read: `frontend/src/data/featureTemplates.ts`
- Read: `frontend/src/data/featurePrompts.ts`
- Read: `frontend/src/app/components/TranslatePanel.tsx`
- Read: `frontend/src/app/image/page.tsx`
- Read: `frontend/src/lib/services/image-generator.ts`
- Read: `frontend/src/lib/services/image-editor.ts`
- Read: `backend/src/api/translate_routes.py`
- Read: `backend/src/api/slides_routes.py`
- Read: `backend/src/api/webapp.py`
- Read: `neloo-configurator/references/configuration-map.md`

**Step 1: Confirm branch and worktree state**

Run:

```bash
git status --short --branch
```

Expected: branch is `main` or the intended feature branch. Note any unrelated dirty files and do not revert them.

**Step 2: Locate feature entry points**

Run:

```bash
rg -n "FeatureButtons|selectedFeature|TranslatePanel|ImageExperience|SlidesExperience|getHumanizePrompt|getPromptOptimizePrompt" frontend/src/app frontend/src/data
```

Expected: the six homepage actions are reachable from `frontend/src/app/page.tsx` and `frontend/src/app/components/FeatureButtons.tsx`.

**Step 3: Locate existing provider/config references**

Run:

```bash
rg -n "TUZI|Tu-Zi|NEXT_PUBLIC_.*(DEEPSEEK|QWEN|IMAGE).*API_KEY|NANOBANANA|OPENAI_IMAGE|slide_presentations|/api/translate|/api/slides" frontend backend neloo-configurator README.md docs -g '!node_modules' -g '!docs/plans/**'
```

Expected before implementation: this identifies all configuration and route surfaces that need alignment. After implementation, there must be no Tu-Zi references and no browser-exposed paid model keys.

**Step 4: Commit baseline only if the repository has unrelated in-progress work**

Do not commit unrelated user changes. If the current task starts from a clean state, skip this step.

---

### Task 2: Remove Tu-Zi and Browser-Exposed Provider Secrets

**Files:**
- Modify: `frontend/.env.example`
- Modify: `backend/.env.example`
- Modify: `README.md`
- Modify: `docs/configuration.md`
- Modify: `frontend/README.md`
- Modify: `neloo-configurator/SKILL.md`
- Modify: `neloo-configurator/references/configuration-map.md`
- Modify: `neloo-configurator/scripts/check-env.mjs`
- Test: `neloo-configurator/scripts/check-env.test.mjs`

**Step 1: Add failing checks for unsafe provider variables**

Update `neloo-configurator/scripts/check-env.test.mjs` with cases that fail when:

- `NEXT_PUBLIC_DEEPSEEK_API_KEY` exists in `frontend/.env.local`
- `NEXT_PUBLIC_QWEN_API_KEY` exists in `frontend/.env.local`
- `NEXT_PUBLIC_TUZI_API_KEY` or `NEXT_PUBLIC_TUZI_IMAGE_API_KEY` exists
- `NEXT_PUBLIC_IMAGE_API_URL` is treated as the primary image API config

Expected test shape:

```js
assert.equal(hasCode(report, "server-secret-in-frontend"), true);
```

**Step 2: Run the focused test and confirm it fails**

Run:

```bash
node --test neloo-configurator/scripts/check-env.test.mjs
```

Expected: FAIL until the validator recognizes the unsafe keys.

**Step 3: Update environment examples**

In `frontend/.env.example`, keep only browser-safe public keys under `NEXT_PUBLIC_*`. Add server-side Next.js image route secrets without public prefixes:

```dotenv
NANOBANANA_IMAGE_API_KEY=
NANOBANANA_IMAGE_BASE_URL=
NANOBANANA_IMAGE_MODEL=nano-banana
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com
OPENAI_IMAGE_MODEL=gpt-image-2
```

In `backend/.env.example`, keep chat model provider keys on the backend:

```dotenv
DEEPSEEK_API_KEY=
QWEN_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
OPENROUTER_API_KEY=
```

Do not add `NEXT_PUBLIC_*` versions for paid provider keys.

**Step 4: Update configurator validation**

In `neloo-configurator/scripts/check-env.mjs`:

- Keep backend chat keys in `CHAT_MODEL_KEYS`.
- Keep `SERVER_ONLY_KEYS` including all paid model keys and platform secrets.
- Ensure `ALLOWED_PUBLIC_PROVIDER_KEYS` stays empty unless a truly browser-safe provider key exists.
- Warn when Nano Banana has only key or only base URL.
- Warn when `OPENAI_IMAGE_MODEL` exists without `OPENAI_API_KEY`.

**Step 5: Update docs and skill references**

In `README.md`, `docs/configuration.md`, `frontend/README.md`, `neloo-configurator/SKILL.md`, and `neloo-configurator/references/configuration-map.md`:

- State that chat model keys are configured in `backend/.env`.
- State that image provider keys are configured in `frontend/.env.local` as server-side Next.js route variables.
- Mention Nano Banana and GPT Image 2 only.
- Remove all Tu-Zi setup instructions.

**Step 6: Verify absence**

Run:

```bash
rg -n "TUZI|Tu-Zi|NEXT_PUBLIC_DEEPSEEK_API_KEY|NEXT_PUBLIC_QWEN_API_KEY|NEXT_PUBLIC_IMAGE_API_URL" frontend backend README.md docs neloo-configurator .agents .claude -g '!node_modules' -g '!docs/plans/**'
```

Expected: no output.

**Step 7: Run focused tests**

Run:

```bash
node --test neloo-configurator/scripts/check-env.test.mjs
```

Expected: PASS.

**Step 8: Commit**

```bash
git add frontend/.env.example backend/.env.example README.md docs/configuration.md frontend/README.md neloo-configurator/SKILL.md neloo-configurator/references/configuration-map.md neloo-configurator/scripts/check-env.mjs neloo-configurator/scripts/check-env.test.mjs
git commit -m "chore: align provider configuration for open source setup"
```

---

### Task 3: Server-Side Image Provider Routing

**Files:**
- Modify: `frontend/src/lib/services/image-generator.ts`
- Modify: `frontend/src/lib/services/image-editor.ts`
- Modify: `frontend/src/app/api/generate-image/route.ts`
- Modify: `frontend/src/app/api/edit/route.ts`
- Modify: `frontend/src/app/image/page.tsx`
- Modify: `frontend/src/app/components/canvas/ImageCanvas.tsx`

**Step 1: Define provider resolver behavior**

`frontend/src/lib/services/image-generator.ts` should resolve providers as:

```ts
type ImageProvider = "nanobanana" | "openai";

const DEFAULT_NANO_BANANA_MODEL = "nano-banana";
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-2";

export function resolveImageProvider(model?: string): ProviderConfig {
  const normalized = (model || "").trim().toLowerCase();

  if (normalized === "gpt-image-2" || normalized === "openai") {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY for GPT Image 2");
    return {
      provider: "openai",
      apiKey,
      baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/+$/, ""),
      model: process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_OPENAI_IMAGE_MODEL,
    };
  }

  const apiKey = process.env.NANOBANANA_IMAGE_API_KEY?.trim();
  const baseUrl = process.env.NANOBANANA_IMAGE_BASE_URL?.trim();
  if (!apiKey) throw new Error("Missing NANOBANANA_IMAGE_API_KEY");
  if (!baseUrl) throw new Error("Missing NANOBANANA_IMAGE_BASE_URL");

  return {
    provider: "nanobanana",
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model: process.env.NANOBANANA_IMAGE_MODEL?.trim() || model || DEFAULT_NANO_BANANA_MODEL,
  };
}
```

**Step 2: Route generation through Next.js server route**

Ensure `frontend/src/app/api/generate-image/route.ts`:

- Reads `prompt`, `resolution`, `size`, and `model` from JSON.
- Validates `prompt`.
- Calls `generateImage(...)` server-side.
- Returns `{ images }`.

**Step 3: Route editing through Next.js server route**

Ensure `frontend/src/app/api/edit/route.ts`:

- Reads `originalImageUrl`, `markedImageDataUrl`, `prompt`, `model`, `resolution`, and `size` from `FormData`.
- Calls `editImage(...)`.
- Returns `{ urls }`.

**Step 4: Update image model UI**

In `frontend/src/app/image/page.tsx`, the model list should contain only:

```ts
{ name: "Nano Banana", modelId: "nano-banana" }
{ name: "GPT Image 2", modelId: "gpt-image-2" }
```

Nano Banana should be the default.

**Step 5: Verify no client-side provider secrets**

Run:

```bash
rg -n "process\\.env\\.(NEXT_PUBLIC_)?(DEEPSEEK|QWEN|OPENAI|NANOBANANA|TUZI).*API_KEY" frontend/src -g '!node_modules'
```

Expected: only server route or server service files reference non-public provider secrets; no browser component should read paid provider API keys.

**Step 6: Type/build check**

Run:

```bash
cd frontend && yarn build
```

Expected: build succeeds or fails only for unrelated pre-existing issues. If it fails because of this task, fix before continuing.

**Step 7: Commit**

```bash
git add frontend/src/lib/services/image-generator.ts frontend/src/lib/services/image-editor.ts frontend/src/app/api/generate-image/route.ts frontend/src/app/api/edit/route.ts frontend/src/app/image/page.tsx frontend/src/app/components/canvas/ImageCanvas.tsx
git commit -m "feat: route image generation through server providers"
```

---

### Task 4: Complete Homepage Feature Button Routing

**Files:**
- Modify: `frontend/src/app/components/FeatureButtons.tsx`
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/data/featureTemplates.ts`
- Modify: `frontend/src/locales/en.json`
- Modify: `frontend/src/locales/zh-CN.json`
- Modify: `frontend/src/locales/zh-TW.json`
- Modify: `frontend/src/locales/ja.json`
- Test: `frontend/scripts/check-ui-i18n.mjs`

**Step 1: Confirm visible action list**

The homepage action row should show:

- `image`
- `slides`
- `prompt-optimize`
- `fortune`
- `deai`
- `translate`

It should not show hidden/deprecated actions such as `web-dev` or `resume` in this homepage row unless the product explicitly brings them back later.

**Step 2: Update feature selection behavior**

In `frontend/src/app/page.tsx`, `handleSelectFeature` should:

- Open `ImageExperience` when `feature.id === "image"`.
- Open `TranslatePanel` when `feature.id === "translate"`.
- Enter slides mode when `feature.id === "slides"`.
- Keep prompt optimize, fortune, and humanize in chat-submit mode.

**Step 3: Update submit behavior**

In `handlePromptSubmit`:

- `fortune`: set fortune mode, inject `getFortuneTemplatePrefix(...)`.
- `slides`: enter `SlidesExperience` with file, prompt, preset, and style.
- `prompt-optimize`: inject `getPromptOptimizePrompt(selectedTextTemplateId)`.
- `deai`: inject `getHumanizePrompt(selectedTextTemplateId)`.
- default: send normal chat.

**Step 4: Run i18n audit**

Run:

```bash
cd frontend && yarn i18n:audit
```

Expected: PASS. Add any missing locale keys rather than hardcoding visible English or Chinese strings in components.

**Step 5: Commit**

```bash
git add frontend/src/app/components/FeatureButtons.tsx frontend/src/app/page.tsx frontend/src/data/featureTemplates.ts frontend/src/locales/en.json frontend/src/locales/zh-CN.json frontend/src/locales/zh-TW.json frontend/src/locales/ja.json frontend/scripts/check-ui-i18n.mjs
git commit -m "feat: complete homepage feature actions"
```

---

### Task 5: Humanize and Prompt Optimize Hidden Prompts

**Files:**
- Modify: `frontend/src/data/featurePrompts.ts`
- Modify: `frontend/src/app/page.tsx`

**Step 1: Add the approved Humanize prompt**

`getHumanizePrompt(...)` must use this base instruction, preserving the substance:

```ts
const HUMANIZE_BASE_PROMPT = `Act like a professional content writer and communication strategist. Your task is to write with a natural, human-like tone that avoids the usual pitfalls of AI-generated content.

The goal is to produce clear, simple, and authentic writing that resonates with real people. Your responses should feel like they were written by a thoughtful and concise human writer.

Follow these detailed step-by-step guidelines:

Step 1: Use plain and simple language. Avoid long or complex sentences. Opt for short, clear statements.
Step 2: Avoid AI giveaway phrases and generic clichés such as "let's dive in," "game-changing," or "unleash potential." Replace them with straightforward language.
Step 3: Be direct and concise. Eliminate filler words and unnecessary phrases. Focus on getting to the point.
Step 4: Maintain a natural tone. Write like you speak. It is okay to start sentences with "and" or "but." Make it feel conversational, not robotic.
Step 5: Avoid marketing buzzwords, hype, and overpromises. Use neutral, honest descriptions.
Step 6: Keep it real. Be honest. Do not fake friendliness or exaggerate.
Step 7: Simplify grammar. Do not worry about perfect grammar if it disrupts natural flow. Casual expressions are okay when suitable.
Step 8: Remove fluff. Avoid unnecessary adjectives or adverbs. Stick to the facts or the core message.
Step 9: Focus on clarity. The message should be easy to read and understand without ambiguity.

Follow this structure rigorously. Your final writing should feel honest, grounded, and like it was written by a clear-thinking, real person.`;
```

**Step 2: Return only the desired output**

Append:

```ts
Rewrite the user's text. Return only the rewritten text.
```

**Step 3: Keep prompt optimize narrow**

`getPromptOptimizePrompt(...)` should instruct the model to improve the prompt without answering the underlying task:

```ts
Do not answer the user's task. Only return the improved prompt.
```

**Step 4: Wire both prompts through `onPromptSubmit`**

In `frontend/src/app/page.tsx`, pass the hidden prompt as the second argument:

```ts
onPromptSubmit(userInput, getPromptOptimizePrompt(selectedTextTemplateId));
onPromptSubmit(userInput, getHumanizePrompt(selectedTextTemplateId));
```

**Step 5: Verify**

Run:

```bash
rg -n "getHumanizePrompt|getPromptOptimizePrompt|Do not answer the user's task|Return only the rewritten text" frontend/src/app/page.tsx frontend/src/data/featurePrompts.ts
```

Expected: all four signals are present.

**Step 6: Commit**

```bash
git add frontend/src/data/featurePrompts.ts frontend/src/app/page.tsx
git commit -m "feat: add hidden text transformation prompts"
```

---

### Task 6: Translation Uses the Selected Backend Model

**Files:**
- Modify: `frontend/src/app/components/TranslatePanel.tsx`
- Modify: `frontend/src/app/page.tsx`
- Modify: `backend/src/api/translate_routes.py`
- Modify: `backend/src/api/webapp.py`
- Modify: `frontend/src/locales/en.json`
- Modify: `frontend/src/locales/zh-CN.json`
- Modify: `frontend/src/locales/zh-TW.json`
- Modify: `frontend/src/locales/ja.json`

**Step 1: Backend request schema**

`backend/src/api/translate_routes.py` should accept:

```py
class TranslateRequest(BaseModel):
    text: str
    target_language: str = "English"
    source_language: str = "auto"
    style: str = "general"
    model_id: str | None = None
```

**Step 2: Backend model selection**

The route should use:

```py
model = get_model(request.model_id or "deepseek")
```

If the selected model is unconfigured, return a clear error:

```py
raise HTTPException(status_code=500, detail=f"Selected model is not configured: {exc}")
```

**Step 3: Source language behavior**

If `source_language === "auto"`, the system prompt should instruct the model to detect source language automatically. Otherwise it should tell the model the explicit source language.

**Step 4: Frontend model propagation**

In `frontend/src/app/page.tsx`, pass the current assistant graph/model id into `TranslatePanel`:

```tsx
<TranslatePanel modelId={assistant?.graph_id || assistant?.assistant_id} ... />
```

In `TranslatePanel`, include `model_id` in the POST body:

```ts
body: JSON.stringify({
  text: sourceText,
  source_language: sourceLang,
  target_language: targetLang,
  style: selectedStyle,
  model_id: modelId,
})
```

**Step 5: Compile backend route**

Run:

```bash
python3 -m py_compile backend/src/api/translate_routes.py backend/src/api/webapp.py
```

Expected: PASS.

**Step 6: Run frontend checks**

Run:

```bash
cd frontend && yarn i18n:audit
cd frontend && yarn build
```

Expected: PASS or only unrelated legacy lint/build issues. Any translation-specific failure must be fixed.

**Step 7: Commit**

```bash
git add frontend/src/app/components/TranslatePanel.tsx frontend/src/app/page.tsx backend/src/api/translate_routes.py backend/src/api/webapp.py frontend/src/locales/en.json frontend/src/locales/zh-CN.json frontend/src/locales/zh-TW.json frontend/src/locales/ja.json
git commit -m "feat: translate with selected model"
```

---

### Task 7: Server-Side Slides Generation and Persistence

**Files:**
- Create/Modify: `backend/src/api/slides_routes.py`
- Modify: `backend/src/api/webapp.py`
- Modify: `frontend/src/app/slides/lib/slidesService.ts`
- Modify: `frontend/src/app/components/slides/SlidesExperience.tsx`
- Modify: `frontend/src/app/components/slides/slidecraft/services/geminiService.ts`
- Create: `backend/supabase/migrations/008_create_slide_presentations.sql`
- Create: `supabase/migrations/20260702_create_slide_presentations.sql`

**Step 1: Add backend slides router**

Create a FastAPI router with:

- `POST /api/slides/generate` for selected-model text generation.
- `POST /api/slides/presentations` for saving.
- `GET /api/slides/presentations` for listing.
- `GET /api/slides/presentations/{presentation_id}` for loading.
- `DELETE /api/slides/presentations/{presentation_id}` for deletion.

The route may fall back to `.local/slide_presentations.json` when Supabase DB is not enabled.

**Step 2: Register router**

In `backend/src/api/webapp.py`:

```py
from .slides_routes import slides_router
app.include_router(slides_router)
```

**Step 3: Add Supabase migrations**

Both migration locations should create the same table:

```sql
create table if not exists public.slide_presentations (
    id uuid primary key,
    user_id text not null default 'default',
    title text not null default 'Untitled',
    topic text not null,
    slides jsonb not null default '[]'::jsonb,
    attachments jsonb not null default '[]'::jsonb,
    style jsonb,
    preset_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
```

Add an index on `(user_id, updated_at desc)` and a service-role policy that allows backend service access.

**Step 4: Move slide text generation to backend**

In `frontend/src/app/slides/lib/slidesService.ts`, replace direct client model calls with:

```ts
fetch(`${getApiBaseUrl()}/api/slides/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ system, prompt }),
});
```

**Step 5: Move slide image generation to server image route**

Slide images should call:

```ts
fetch("/api/generate-image", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt, size: "16x9", resolution: "1k" }),
});
```

**Step 6: Save generated presentations**

After creating or updating a deck, `SlidesExperience` should call `POST /api/slides/presentations` with:

```ts
{
  title,
  topic,
  slides,
  attachments,
  style,
  preset_id
}
```

**Step 7: Compile backend**

Run:

```bash
python3 -m py_compile backend/src/api/slides_routes.py backend/src/api/webapp.py
```

Expected: PASS.

**Step 8: Build frontend**

Run:

```bash
cd frontend && yarn build
```

Expected: PASS or only unrelated pre-existing issues. Slides-specific TypeScript/build failures must be fixed.

**Step 9: Commit**

```bash
git add backend/src/api/slides_routes.py backend/src/api/webapp.py frontend/src/app/slides/lib/slidesService.ts frontend/src/app/components/slides/SlidesExperience.tsx frontend/src/app/components/slides/slidecraft/services/geminiService.ts backend/supabase/migrations/008_create_slide_presentations.sql supabase/migrations/20260702_create_slide_presentations.sql
git commit -m "feat: add server-side slides generation and history"
```

---

### Task 8: Fortune Telling Input Completeness

**Files:**
- Modify: `frontend/src/app/components/TemplatePromptInput.tsx`
- Modify: `frontend/src/data/fortuneTemplatePrefix.ts`
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/locales/en.json`
- Modify: `frontend/src/locales/zh-CN.json`
- Modify: `frontend/src/locales/zh-TW.json`
- Modify: `frontend/src/locales/ja.json`

**Step 1: Validate required fortune fields**

Before sending a fortune prompt, require the birth/fortune fields needed by the selected fortune template. At minimum, the UX should not submit an empty or obviously incomplete fortune request.

**Step 2: Keep hidden prefix invisible**

The user should see only their own input in the visible conversation, while the backend receives the fortune template prefix through the hidden prompt argument.

**Step 3: Verify prefix path**

Run:

```bash
rg -n "getFortuneTemplatePrefix|fortune" frontend/src/app/page.tsx frontend/src/data/fortuneTemplatePrefix.ts frontend/src/app/components/TemplatePromptInput.tsx
```

Expected: selected template prefix is used only for backend prompt context.

**Step 4: Run frontend checks**

```bash
cd frontend && yarn i18n:audit
cd frontend && yarn build
```

Expected: PASS or only unrelated pre-existing issues.

**Step 5: Commit**

```bash
git add frontend/src/app/components/TemplatePromptInput.tsx frontend/src/data/fortuneTemplatePrefix.ts frontend/src/app/page.tsx frontend/src/locales/en.json frontend/src/locales/zh-CN.json frontend/src/locales/zh-TW.json frontend/src/locales/ja.json
git commit -m "feat: validate fortune requests before submission"
```

---

### Task 9: Configurator and README Coverage

**Files:**
- Modify: `README.md`
- Modify: `docs/configuration.md`
- Modify: `frontend/README.md`
- Modify: `backend/README.md`
- Modify: `neloo-configurator/SKILL.md`
- Modify: `neloo-configurator/references/configuration-map.md`
- Modify: `neloo-configurator/scripts/setup-env.mjs`
- Modify: `neloo-configurator/scripts/check-env.mjs`
- Test: `neloo-configurator/scripts/setup-env.test.mjs`
- Test: `neloo-configurator/scripts/check-env.test.mjs`
- Modify if present: `.agents/skills/neloo-configurator/SKILL.md`
- Modify if present: `.claude/skills/neloo-configurator/SKILL.md`

**Step 1: Document where users configure each provider**

Docs must clearly state:

- Chat model selector providers: `backend/.env`
- Supabase/Railway/E2B: `backend/.env` or Railway service environment
- Image providers: `frontend/.env.local` or Vercel frontend environment, server-side only
- Google Drive public keys: `frontend/.env.local` with `NEXT_PUBLIC_*`

**Step 2: Update configurator skill behavior**

The skill should tell users:

- Do not put paid provider secrets in `NEXT_PUBLIC_*`.
- Configure Nano Banana with `NANOBANANA_IMAGE_API_KEY` and `NANOBANANA_IMAGE_BASE_URL`.
- Configure GPT Image 2 with `OPENAI_API_KEY` and optional `OPENAI_IMAGE_MODEL`.
- Configure at least one complete backend chat model provider.

**Step 3: Update setup script next steps**

`neloo-configurator/scripts/setup-env.mjs` should print concise next steps for:

- Backend model key
- Frontend `NEXT_PUBLIC_API_URL`
- Optional image provider
- Optional Supabase/Railway/E2B

**Step 4: Run configurator tests**

Run:

```bash
node --test neloo-configurator/scripts/setup-env.test.mjs neloo-configurator/scripts/check-env.test.mjs
```

Expected: PASS.

**Step 5: Commit**

```bash
git add README.md docs/configuration.md frontend/README.md backend/README.md neloo-configurator/SKILL.md neloo-configurator/references/configuration-map.md neloo-configurator/scripts/setup-env.mjs neloo-configurator/scripts/check-env.mjs neloo-configurator/scripts/setup-env.test.mjs neloo-configurator/scripts/check-env.test.mjs .agents/skills/neloo-configurator/SKILL.md .claude/skills/neloo-configurator/SKILL.md
git commit -m "docs: clarify feature provider configuration"
```

---

### Task 10: Final Verification

**Files:**
- Verify entire touched surface.

**Step 1: Run secret/config regression checks**

Run:

```bash
rg -n "TUZI|Tu-Zi|NEXT_PUBLIC_DEEPSEEK_API_KEY|NEXT_PUBLIC_QWEN_API_KEY|NEXT_PUBLIC_TUZI_API_KEY|NEXT_PUBLIC_TUZI_IMAGE_API_KEY|NEXT_PUBLIC_IMAGE_API_URL" frontend backend README.md docs neloo-configurator .agents .claude -g '!node_modules' -g '!docs/plans/**'
```

Expected: no output.

Run:

```bash
rg -n "process\\.env\\.NEXT_PUBLIC_.*(API_KEY|SECRET|TOKEN)" frontend/src -g '!node_modules'
```

Expected: only intentionally public browser keys, such as Google Picker or LangSmith public client values. No paid LLM or image provider secrets.

**Step 2: Run configurator tests**

```bash
node --test neloo-configurator/scripts/check-env.test.mjs neloo-configurator/scripts/setup-env.test.mjs
```

Expected: PASS.

**Step 3: Run backend compile checks**

```bash
python3 -m py_compile backend/src/api/slides_routes.py backend/src/api/translate_routes.py backend/src/api/webapp.py backend/src/api/agent_routes.py backend/src/agent/graph.py backend/src/model_ids.py
```

Expected: PASS.

**Step 4: Run frontend i18n audit**

```bash
cd frontend && yarn i18n:audit
```

Expected: PASS.

**Step 5: Run frontend build**

```bash
cd frontend && yarn build
```

Expected: PASS.

**Step 6: Run whitespace check**

```bash
git diff --check
```

Expected: no output.

**Step 7: Optional manual browser check**

Start the app if it is not already running:

```bash
cd backend && langgraph dev --config langgraph.json
cd frontend && yarn dev
```

In the browser:

- Open the homepage.
- Click each of the six feature buttons.
- Confirm each opens the expected workflow or submits with the expected behavior.
- Confirm missing provider config produces a clear error and not a silent failure.

**Step 8: Commit verification-only fixes if needed**

If verification revealed small task-scope issues, fix them and commit:

```bash
git add <changed-files>
git commit -m "fix: stabilize homepage feature actions"
```

---

### Task 11: Push and Report

**Files:**
- No code edits unless final verification found task-scope issues.

**Step 1: Confirm clean worktree**

```bash
git status --short --branch
```

Expected: no unstaged or uncommitted changes.

**Step 2: Push to GitHub main**

```bash
git push origin main
```

Expected: push succeeds.

**Step 3: Final user report**

Report from the user's perspective:

- The homepage now shows complete usable feature actions.
- Image uses Nano Banana or GPT Image 2 with server-side keys.
- Translation and slides use the selected top-left model.
- Slides can save history.
- Provider configuration is documented in README/configuration/configurator skill.
- No Tu-Zi or browser-exposed paid provider keys remain.

Also report any verification command that could not be run or any unrelated legacy failures.
