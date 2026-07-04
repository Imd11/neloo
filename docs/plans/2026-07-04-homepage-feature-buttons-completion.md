# Homepage Feature Buttons Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every homepage feature button and its templates feel complete, visibly selected, and functionally connected to the correct backend prompt or API path.

**Architecture:** Keep the existing feature button entry points, but standardize template metadata and selection behavior across AI Image, Slides, Prompt Optimize, Fortune Telling, Humanize, and AI Translate. Template selection should always update visible UI state and should always map to a concrete backend instruction, prompt prefix, or API request field.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, LangGraph SDK stream client, FastAPI backend routes, existing `featureTemplates.ts`, `featurePrompts.ts`, `fortuneTemplatePrefix.ts`, and slidecraft services.

---

### Task 0: Prepare Current Worktree Baseline

**Files:**
- Review only: current git worktree

**Step 1: Inspect current uncommitted changes**

Run:

```bash
cd <repo-root>
git status --short
git diff --stat
```

Expected: understand whether the previous AI Image template work and this plan file are already committed.

**Step 2: Preserve existing intentional changes before feature-button work**

If the worktree contains the previous AI Image implementation changes, commit them before starting this plan:

```bash
git add frontend/src/app/components/FeatureTemplateGrid.tsx \
  frontend/src/app/components/PromptInput.tsx \
  frontend/src/app/components/TabbedTemplateGrid.tsx \
  frontend/src/app/components/TemplateCard.tsx \
  frontend/src/app/components/chat/ImageChatPanel.tsx \
  frontend/src/app/image/page.tsx \
  frontend/src/data/featureTemplates.ts \
  frontend/src/locales/en.json \
  frontend/src/locales/ja.json \
  frontend/src/locales/zh-CN.json \
  frontend/src/locales/zh-TW.json \
  frontend/public/templates
git commit -m "feat: add real AI image templates"
```

Then commit this plan file separately if it is still uncommitted:

```bash
git add docs/plans/2026-07-04-homepage-feature-buttons-completion.md
git commit -m "docs: plan homepage feature button completion"
```

Expected: feature-button work starts from a clean or intentionally staged baseline. Do not proceed with a dirty worktree unless every dirty file is intentionally part of the next task.

---

### Task 1: Baseline Audit And Test Notes

**Files:**
- Create: `docs/plans/homepage-feature-buttons-audit-notes.md`
- Read: `frontend/src/app/page.tsx`
- Read: `frontend/src/data/featureTemplates.ts`
- Read: `frontend/src/data/featurePrompts.ts`
- Read: `frontend/src/data/fortuneTemplatePrefix.ts`
- Read: `frontend/src/app/components/FeatureTemplateGrid.tsx`
- Read: `frontend/src/app/components/PromptInput.tsx`
- Read: `frontend/src/app/components/TemplatePromptInput.tsx`
- Read: `frontend/src/app/components/TranslatePanel.tsx`
- Read: `frontend/src/app/components/slides/SlidesExperience.tsx`
- Read: `frontend/src/app/components/slides/slidecraft/services/geminiService.ts`

**Step 1: Capture current behavior**

Run:

```bash
cd <repo-root>
rg -n "selectedTemplateName|selectedTextTemplateId|selectedFortuneTemplateId|selectedSlidesPresetId|FeatureTemplateGrid|TemplatePromptInput|getHumanizePrompt|getPromptOptimizePrompt|getFortuneTemplatePrefix" frontend/src
```

Expected: identify the existing state flow for each feature without modifying code.

**Step 2: Document current pass/fail status**

Create `docs/plans/homepage-feature-buttons-audit-notes.md` with this checklist:

```markdown
# Homepage Feature Buttons Audit Notes

## AI Image
- Visible template selection:
- Template prompt applied:
- Backend route:
- Remaining issues:

## Slides
- Visible preset selection:
- Preset applied to outline:
- Preset applied to slide images:
- Backend route:
- Remaining issues:

## Prompt Optimize
- Visible template selection:
- Template prompt applied:
- Backend route:
- Remaining issues:

## Fortune Telling
- Visible template selection:
- Template prefix applied:
- Backend route / graph:
- Remaining issues:

## Humanize
- Visible template selection:
- Template prompt applied:
- Backend route:
- Remaining issues:

## AI Translate
- Visible style selection:
- Style prompt applied:
- Backend route:
- Remaining issues:
```

**Step 3: Commit**

```bash
git add docs/plans/homepage-feature-buttons-audit-notes.md
git commit -m "docs: audit homepage feature button behavior"
```

---

### Task 2: Standardize Template Metadata

**Files:**
- Modify: `frontend/src/data/featureTemplates.ts`
- Modify: `frontend/src/data/featurePrompts.ts`
- Modify: `frontend/src/locales/en.json`
- Modify: `frontend/src/locales/zh-CN.json`
- Modify: `frontend/src/locales/zh-TW.json`
- Modify: `frontend/src/locales/ja.json`

**Step 1: Extend the `Template` interface**

In `frontend/src/data/featureTemplates.ts`, add optional fields:

```ts
export interface Template {
    id: number;
    title: string;
    description: string;
    gradient: string;
    prompt?: string;
    previewImage?: string;
    titleKey?: string;
    descriptionKey?: string;
    effectKey?: string;
    exampleInputKey?: string;
    exampleOutputKey?: string;
    userFacingEffect?: string;
    exampleInput?: string;
    exampleOutput?: string;
    /**
     * Backend-facing instruction. Keep this stable and English.
     * Do not localize it through UI locale files.
     */
    promptInstruction?: string;
    model?: string;
    category?: TemplateCategory;
}
```

Update `localizeTemplate` to localize only user-facing display fields. Do not localize `promptInstruction`:

```ts
export function localizeTemplate(template: Template, t: Translate): Template {
    return {
        ...template,
        title: translateWithFallback(t, template.titleKey, template.title),
        description: translateWithFallback(t, template.descriptionKey, template.description),
        userFacingEffect: template.userFacingEffect
            ? translateWithFallback(t, template.effectKey, template.userFacingEffect)
            : undefined,
        exampleInput: template.exampleInput
            ? translateWithFallback(t, template.exampleInputKey, template.exampleInput)
            : undefined,
        exampleOutput: template.exampleOutput
            ? translateWithFallback(t, template.exampleOutputKey, template.exampleOutput)
            : undefined,
        promptInstruction: template.promptInstruction,
    };
}
```

**Step 2: Add real metadata for `prompt-optimize` templates**

For each `prompt-optimize` template, add `userFacingEffect` and `promptInstruction`:

```ts
{
    id: 1,
    title: "Image Generation",
    userFacingEffect: "Turns rough image ideas into detailed prompts with subject, composition, lighting, style, camera, aspect ratio, and constraints.",
    promptInstruction: "Optimize the user's prompt specifically for image generation. Include subject, scene, style, camera angle, composition, lighting, color palette, texture, aspect ratio, and constraints. Return only the improved prompt.",
    ...
}
```

Repeat for copywriting, code generation, role play, data analysis, and general improvement.

**Step 3: Add real metadata for `deai` / Humanize templates**

For each Humanize template, add `userFacingEffect` and `promptInstruction`:

```ts
{
    id: 1,
    title: "Academic Paper",
    userFacingEffect: "Makes academic writing more natural while preserving rigor, citations, terminology, and logical structure.",
    promptInstruction: "Rewrite the user's text for academic writing. Preserve rigor and terminology, reduce mechanical repetition, avoid inflated phrasing, and keep the final text clear and grounded.",
    ...
}
```

Repeat for business copy, news article, social post, email, and creative writing.

**Step 4: Add real metadata for Fortune templates**

For each Fortune template, add `userFacingEffect`:

```ts
{
    id: 4,
    title: "Career",
    userFacingEffect: "Focuses the reading on career direction, suitable industries, promotion timing, and workplace risks.",
    ...
}
```

Do not expose the full fortune prefix in UI.

**Step 5: Refactor prompt lookup helpers**

In `frontend/src/data/featurePrompts.ts`, replace the separate hard-coded maps with exports that can consume template instructions:

```ts
export function getHumanizePrompt(templateId: number | null, instruction?: string): string {
    return `${HUMANIZE_BASE_PROMPT}

${instruction || "Adapt the result to the user's requested context."}

Rewrite the user's text. Return only the rewritten text.`;
}

export function getPromptOptimizePrompt(templateId: number | null, instruction?: string): string {
    return `You are a senior prompt engineer.

${instruction || "Rewrite the user's prompt for general-purpose AI use."}

Requirements:
- Preserve the user's intent.
- Make the prompt specific, testable, and easy for an AI model to follow.
- Add missing context only when it is clearly implied by the user.
- Use clear structure with role, task, constraints, input, and output format when useful.
- Avoid hype, filler, and vague wording.
- Do not answer the user's task. Only return the improved prompt.`;
}
```

Keep fallback maps temporarily if needed, but prefer `template.promptInstruction`.

**Step 6: Add locale keys**

Add locale entries for all new `effect`, `exampleInput`, and `exampleOutput` keys. Do not add `promptInstruction` to locale files. Keep all `promptInstruction` strings as stable English values inside `featureTemplates.ts`.

**Step 7: Validate**

Run:

```bash
cd <repo-root>/frontend
node -e "for (const f of ['src/locales/en.json','src/locales/zh-CN.json','src/locales/zh-TW.json','src/locales/ja.json']) JSON.parse(require('fs').readFileSync(f,'utf8'))"
yarn i18n:audit
npx eslint src/data/featureTemplates.ts src/data/featurePrompts.ts
```

Expected: JSON parse succeeds, no hard-coded Chinese UI strings, no lint errors in touched files.

**Step 8: Commit**

```bash
git add frontend/src/data/featureTemplates.ts frontend/src/data/featurePrompts.ts frontend/src/locales
git commit -m "feat: standardize feature template metadata"
```

---

### Task 3: Add Shared Template Selection UI

**Files:**
- Modify: `frontend/src/app/components/FeatureTemplateGrid.tsx`
- Modify: `frontend/src/app/components/TemplateCard.tsx`
- Modify: `frontend/src/app/components/PromptInput.tsx`
- Modify: `frontend/src/app/components/TemplatePromptInput.tsx`
- Modify: `frontend/src/locales/en.json`
- Modify: `frontend/src/locales/zh-CN.json`
- Modify: `frontend/src/locales/zh-TW.json`
- Modify: `frontend/src/locales/ja.json`

**Step 1: Add selected template support to `FeatureTemplateGrid`**

Update props:

```ts
interface FeatureTemplateGridProps {
    feature: Feature | null;
    selectedTemplateId?: number | null;
    onSelectTemplate?: (template: Template) => void;
}
```

Pass `selected={selectedTemplateId === template.id}` into `TemplateCard`.

**Step 2: Add template details under selected grid**

Inside `FeatureTemplateGrid`, find the selected template and render a compact detail panel:

```tsx
{selectedTemplate && selectedTemplate.userFacingEffect && (
    <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
        <div className="text-sm font-medium text-foreground">{selectedTemplate.title}</div>
        <p className="mt-1 text-sm text-muted-foreground">{selectedTemplate.userFacingEffect}</p>
        {selectedTemplate.exampleInput && (
            <div className="mt-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{t("chat.template_example_input")}: </span>
                {selectedTemplate.exampleInput}
            </div>
        )}
        {selectedTemplate.exampleOutput && (
            <div className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{t("chat.template_example_output")}: </span>
                {selectedTemplate.exampleOutput}
            </div>
        )}
    </div>
)}
```

**Step 3: Make `TemplateCard` selected state visually clear**

Ensure selected cards show stable ring/check feedback:

```tsx
{selected && (
    <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
        <Check className="h-3 w-3" />
    </div>
)}
```

Use `lucide-react` `Check`.

**Step 4: Add clearable template capsule to `TemplatePromptInput`**

Add props:

```ts
selectedTemplateName?: string | null;
onClearTemplate?: () => void;
```

Render the same template capsule pattern used in `PromptInput`. This is required for Fortune Telling because it uses `TemplatePromptInput`, not `PromptInput`.

**Step 5: Add locale keys**

Add:

```json
"template_example_input": "Example input",
"template_example_output": "Example output",
"clear_selected_template": "Clear selected template"
```

with localized values in Chinese, Traditional Chinese, and Japanese.

**Step 6: Validate**

Run:

```bash
cd <repo-root>/frontend
npx eslint src/app/components/FeatureTemplateGrid.tsx src/app/components/TemplateCard.tsx src/app/components/PromptInput.tsx src/app/components/TemplatePromptInput.tsx
yarn i18n:audit
```

Expected: no lint errors in touched files, i18n audit passes.

**Step 7: Commit**

```bash
git add frontend/src/app/components/FeatureTemplateGrid.tsx frontend/src/app/components/TemplateCard.tsx frontend/src/app/components/PromptInput.tsx frontend/src/app/components/TemplatePromptInput.tsx frontend/src/locales
git commit -m "feat: unify template selection feedback"
```

---

### Task 4: Wire Prompt Optimize, Humanize, And Fortune Selection State

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/data/featurePrompts.ts`
- Modify: `frontend/src/data/fortuneTemplatePrefix.ts`

**Step 1: Replace separate template state with a selected template object**

In `LandingView`, add:

```ts
const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
```

Keep `selectedSlidesPresetId` separate because Slides uses preset IDs.

**Step 2: Reset template on feature change**

Update the existing effect:

```ts
useEffect(() => {
    setSelectedTemplate(null);
    setSelectedTemplateName(null);
    setSelectedFortuneTemplateId(null);
    setSelectedTextTemplateId(null);
}, [selectedFeature?.id]);
```

**Step 3: Set selected template consistently**

In `handleSelectTemplate`, always call:

```ts
setSelectedTemplate(template);
setSelectedTemplateName(template.title);
```

Then set feature-specific IDs as needed.

**Step 4: Use template instruction for text features**

In `handlePromptSubmit`, update:

```ts
} else if (selectedFeature?.id === 'prompt-optimize') {
    setFortuneMode(false);
    setActiveFeatureId('prompt-optimize');
    onPromptSubmit(userInput, getPromptOptimizePrompt(selectedTemplate?.id ?? null, selectedTemplate?.promptInstruction));
} else if (selectedFeature?.id === 'deai') {
    setFortuneMode(false);
    setActiveFeatureId('deai');
    onPromptSubmit(userInput, getHumanizePrompt(selectedTemplate?.id ?? null, selectedTemplate?.promptInstruction));
}
```

**Step 5: Wire Fortune selected template into `TemplatePromptInput`**

Fortune templates must not rewrite the birth-info input form text. The structured birth input remains the same for all Fortune templates:

```text
I was born on ...
```

or the localized equivalent. Template choice changes only:

```text
Visible UI: adds a selected template capsule, for example [Career ×]
Selected card: shows a selected state
Backend/model input: uses the matching hidden fortune prefix from `getFortuneTemplatePrefix(templateId)`
```

This means the user understands the selected analysis direction without seeing or editing the hidden BaZi prompt.

Pass:

```tsx
selectedTemplateName={selectedTemplateName}
onClearTemplate={() => {
    setSelectedTemplate(null);
    setSelectedTemplateName(null);
    setSelectedFortuneTemplateId(null);
}}
```

**Step 6: Wire selected state into `FeatureTemplateGrid`**

Pass:

```tsx
selectedTemplateId={selectedTemplate?.id ?? null}
```

**Step 7: Add clear template behavior to normal input**

Pass to `PromptInput`:

```tsx
onClearTemplate={() => {
    setSelectedTemplate(null);
    setSelectedTemplateName(null);
    setSelectedTextTemplateId(null);
}}
```

**Step 8: Verify hidden template instructions do not leak into visible history**

The current chat path prepends hidden instructions to the user message before submitting to LangGraph while showing only the original user text in the optimistic UI. After increasing template usage, verify this invariant explicitly:

```text
Visible chat bubble: user's original text only
Backend/model input: template instruction + user's original text
Reloaded history: user's original text only
Generated thread title: user's original text only
Regenerate/fork flow: does not expose template instruction in the visible UI
```

For Fortune specifically, also verify:

```text
Changing from Career to Wealth changes the hidden prefix.
The visible birth-info form text remains unchanged.
The visible selected template capsule changes from Career to Wealth.
```

If hidden instructions appear after reload, do not continue with the simple prefix approach. Instead, add a sanitization layer before persistence/history display, or move template instructions into a separate system message/metadata path that is not rendered as user content.

**Step 9: Validate by browser automation**

Use system Chrome with Playwright:

```js
await page.goto('http://localhost:3000/');
await page.getByText(/Humanize|去AI化/).first().click();
await page.getByText(/学术论文|Academic Paper/).first().click();
expect(await page.locator('body').innerText()).toContain('学术论文');
```

Repeat for Prompt Optimize and Fortune. Expected: selected template capsule is visible and selected card has selected state.

**Step 10: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/data/featurePrompts.ts frontend/src/data/fortuneTemplatePrefix.ts
git commit -m "feat: wire feature templates into prompt instructions"
```

---

### Task 5: Generate Or Add Preview Images For Text Feature Templates

**Files:**
- Create: `frontend/public/templates/prompt-optimize/*.webp`
- Create: `frontend/public/templates/humanize/*.webp`
- Create: `frontend/public/templates/fortune/*.webp`
- Modify: `frontend/src/data/featureTemplates.ts`

**Step 1: Decide preview image scope**

Create one preview image per template for every template that does not already have a real preview image:

- Prompt Optimize: 6 images
- Humanize: 6 images
- Fortune: 8 images

Total: 20 images.

Use compressed `.webp` by default. Use `.png` only if the generation pipeline cannot produce acceptable WebP. Keep each asset reasonably small; avoid committing multi-megabyte decorative previews when a compressed preview is enough.

**Step 2: Generate Humanize preview images one by one**

Use GPT Image or the available image generation path. Prompts should be abstract UI/illustration style, not copyrighted or person-specific. Do not use readable text inside the images; the card title already supplies the text.

Generate these exact Humanize previews:

| Template | File | Image generation prompt |
|---|---|---|
| Academic Paper | `frontend/public/templates/humanize/academic-paper.webp` | `Create a clean editorial-style preview image for an academic writing humanizer template. Show a refined desk scene with research papers, margin notes, subtle citation marks, and calm neutral lighting. Minimal, professional, no readable text, 4:3 composition.` |
| Business Copy | `frontend/public/templates/humanize/business-copy.webp` | `Create a polished preview image for a business copy humanizer template. Show a modern workspace with a brand brief, simple message blocks, and restrained corporate accents. Credible, calm, not salesy, no readable text, 4:3 composition.` |
| News Article | `frontend/public/templates/humanize/news-article.webp` | `Create a newsroom-style preview image for a news article rewriting template. Show an editor desk, neutral paper layout blocks, a subtle press-room atmosphere, and factual editorial tone. No readable text, no logos, 4:3 composition.` |
| Social Post | `frontend/public/templates/humanize/social-post.webp` | `Create a friendly preview image for a social media humanizer template. Show overlapping mobile post cards, casual message bubbles, and warm conversational energy. Modern, natural, no readable text, no platform logos, 4:3 composition.` |
| Email | `frontend/public/templates/humanize/email.webp` | `Create a professional preview image for an email humanizer template. Show a clean email composition interface abstractly, with soft message blocks, check marks, and a polite business tone. No readable text, no brand logos, 4:3 composition.` |
| Creative Writing | `frontend/public/templates/humanize/creative-writing.webp` | `Create an atmospheric preview image for a creative writing humanizer template. Show a notebook, soft lamp light, textured paper, and subtle story fragments represented as abstract shapes. Literary, grounded, no readable text, 4:3 composition.` |

**Step 3: Generate Prompt Optimize preview images one by one**

Generate these exact Prompt Optimize previews:

| Template | File | Image generation prompt |
|---|---|---|
| Image Generation | `frontend/public/templates/prompt-optimize/image-generation.webp` | `Create a preview image for an AI image prompt optimization template. Show a clean prompt panel transforming into visual moodboard tiles, camera, lighting, color palette, and composition symbols. No readable text, 4:3 composition.` |
| Copywriting | `frontend/public/templates/prompt-optimize/copywriting.webp` | `Create a preview image for a copywriting prompt optimization template. Show a clear message hierarchy, headline blocks, audience targeting symbols, and concise writing structure. No readable text, no logos, 4:3 composition.` |
| Code Generation | `frontend/public/templates/prompt-optimize/code-generation.webp` | `Create a preview image for a code generation prompt optimization template. Show abstract code blocks, architecture nodes, test checkmarks, and clean developer workflow visuals. No readable text, 4:3 composition.` |
| Role Play | `frontend/public/templates/prompt-optimize/role-play.webp` | `Create a preview image for an AI role-play/persona prompt template. Show layered character cards, instruction panels, and role constraints as abstract interface elements. No readable text, 4:3 composition.` |
| Data Analysis | `frontend/public/templates/prompt-optimize/data-analysis.webp` | `Create a preview image for a data analysis prompt optimization template. Show clean charts, table blocks, data pipeline nodes, and analytical structure. No readable text, 4:3 composition.` |
| General Improve | `frontend/public/templates/prompt-optimize/general-improve.webp` | `Create a preview image for a general prompt improvement template. Show a rough input block becoming a structured checklist and output card. Clean, neutral, practical, no readable text, 4:3 composition.` |

**Step 4: Generate Fortune preview images one by one**

Generate these exact Fortune previews:

| Template | File | Image generation prompt |
|---|---|---|
| Full Bazi Reading | `frontend/public/templates/fortune/full-bazi-reading.webp` | `Create a refined symbolic preview image for a full BaZi reading template. Show four-pillar chart motifs, five element symbols, subtle celestial lines, amber and ink-blue palette. No readable text, 4:3 composition.` |
| Annual Luck | `frontend/public/templates/fortune/annual-luck.webp` | `Create a refined symbolic preview image for an annual luck fortune template. Show a circular year calendar, flowing seasonal arcs, subtle stars, and warm gold highlights. No readable text, 4:3 composition.` |
| Relationship | `frontend/public/templates/fortune/relationship.webp` | `Create a refined symbolic preview image for a relationship fortune template. Show two interlocking constellation paths, peach blossom motifs, soft rose and gold palette. No readable text, 4:3 composition.` |
| Career | `frontend/public/templates/fortune/career.webp` | `Create a refined symbolic preview image for a BaZi career fortune template. Show a compass, subtle celestial chart lines, and a modern office skyline silhouette. Elegant amber and deep blue palette, no readable text, 4:3 composition.` |
| Wealth | `frontend/public/templates/fortune/wealth.webp` | `Create a refined symbolic preview image for a wealth fortune template. Show flowing coin-like circles, a subtle treasure bowl silhouette, five-element geometry, and warm gold accents. No readable text, 4:3 composition.` |
| Health | `frontend/public/templates/fortune/health.webp` | `Create a refined symbolic preview image for a health fortune template. Show a calm body meridian silhouette, five-element balance symbols, botanical details, teal and warm gold palette. No readable text, 4:3 composition.` |
| Personality | `frontend/public/templates/fortune/personality.webp` | `Create a refined symbolic preview image for a personality fortune template. Show an abstract profile silhouette, five element orbit lines, and layered inner-trait geometry. No readable text, 4:3 composition.` |
| Family | `frontend/public/templates/fortune/family.webp` | `Create a refined symbolic preview image for a family fortune template. Show connected constellation nodes, ancestral tree silhouette, warm lantern-like glow, and gentle ink texture. No readable text, 4:3 composition.` |

**Step 5: Save images into public paths**

Use paths like:

```text
frontend/public/templates/humanize/academic-paper.webp
frontend/public/templates/humanize/business-copy.webp
frontend/public/templates/prompt-optimize/image-generation.webp
frontend/public/templates/fortune/career.webp
```

**Step 6: Reference preview images in template data**

In `featureTemplates.ts`, add `previewImage` to each template:

```ts
previewImage: "/templates/humanize/academic-paper.webp",
```

Every Prompt Optimize, Humanize, and Fortune template must have a `previewImage`. Do not leave any template in these three groups with only a gradient placeholder.

**Step 7: Validate no local path leakage**

Run:

```bash
cd <repo-root>
rg -n "LOCAL_PRIVATE_ASSET_PATTERN" frontend/src frontend/public/templates || true
```

Expected: no matches.

**Step 8: Validate image availability**

Run frontend and request a few images:

```bash
curl -I http://localhost:3000/templates/humanize/academic-paper.webp
curl -I http://localhost:3000/templates/prompt-optimize/image-generation.webp
curl -I http://localhost:3000/templates/fortune/career.webp
```

Expected: HTTP 200.

**Step 9: Commit**

```bash
git add frontend/public/templates frontend/src/data/featureTemplates.ts
git commit -m "feat: add preview images for feature templates"
```

---

### Task 6: Fix Slides Image Provider And Preset Continuity

**Files:**
- Modify: `frontend/src/app/components/slides/slidecraft/components/SlideShow.tsx`
- Modify: `frontend/src/app/components/slides/slidecraft/services/geminiService.ts`
- Modify: `frontend/src/app/components/slides/SlidesExperience.tsx`
- Modify: `frontend/src/app/components/slides/slidecraft/components/Home.tsx`

**Step 1: Keep chat model and image model separate**

Do not pass the homepage chat model ID (`deepseek`, `claude`, `openai`, etc.) into `/api/generate-image`. The image route only supports image provider model IDs such as `nano-banana`, `gpt-image-2`, or `openai`.

The correct behavior for this task is:

```text
Slides outline/content generation -> selected chat model
Slides full-slide image generation -> configured default image model
```

If a future UI exposes a dedicated image model selector inside Slides, pass that dedicated image model ID. Do not reuse `modelId` from `SlidesExperience`.

**Step 2: Make slide image generation explicitly use the default image provider**

Keep the `generateSlideImage` signature free of chat model IDs:

```ts
export async function generateSlideImage(
    slide: Slide,
    style?: StyleDimensions,
    signal?: AbortSignal,
    presetId?: string
): Promise<string> {
```

Do not send `model` in the `/api/generate-image` body unless there is a dedicated image model value:

```ts
body: JSON.stringify({
    prompt,
    size: "16x9",
    resolution: "1k",
}),
```

Expected: `/api/generate-image` resolves the provider from image environment variables, matching the current image service behavior.

**Step 3: Verify `SlideShow` does not pass chat model to image generation**

Keep this call:

```ts
const base64 = await generateSlideImage(slide, style, controller.signal, presentation.presetId);
```

Do not change it to pass `modelId`.

**Step 4: Preserve loaded presentation style and preset**

When loading a presentation, do not discard `style` and `presetId`. Update mapping in `SlidesExperience` history/load code:

```ts
style: item.style as StyleDimensions | undefined,
presetId: item.preset_id || item.presetId,
```

and on loaded presentation:

```ts
setStyle((presentation.style as StyleDimensions | undefined) || undefined);
setPresetId(presentation.preset_id || presentation.presetId);
```

**Step 5: Make preset visibility explicit**

In `Home`, when a preset is recommended but not explicitly selected, show "Recommended" separately from "Selected". Keep current selected pill only for explicit user choice.

**Step 6: Validate**

Run:

```bash
cd <repo-root>/frontend
npx eslint src/app/components/slides/SlidesExperience.tsx src/app/components/slides/slidecraft/components/Home.tsx src/app/components/slides/slidecraft/components/SlideShow.tsx src/app/components/slides/slidecraft/services/geminiService.ts
yarn build
```

Expected: touched files pass lint; build passes.

**Step 7: Commit**

```bash
git add frontend/src/app/components/slides frontend/src/app/slides
git commit -m "fix: preserve slides preset and image provider flow"
```

---

### Task 7: Backend Guest Compatibility Verification

**Files:**
- Read: `backend/src/api/auth.py`
- Read: `backend/src/api/translate_routes.py`
- Read: `backend/src/api/slides_routes.py`
- Test only unless behavior is broken.

**Step 1: Start backend**

Run:

```bash
cd <repo-root>/backend
langgraph dev --config langgraph.json
```

Expected: backend listens on `http://127.0.0.1:2024`.

**Step 2: Verify guest translate request does not require login**

Run:

```bash
curl -sS -X POST http://127.0.0.1:2024/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"你好","target_language":"English","source_language":"auto","style":"general","model_id":"deepseek"}'
```

Expected: either successful translation or model configuration error. It must not fail with "not authenticated".

**Step 3: Verify guest slides request does not require login**

Run:

```bash
curl -sS -X POST http://127.0.0.1:2024/api/slides/generate \
  -H "Content-Type: application/json" \
  -d '{"system":"Return a short answer.","prompt":"Say ok.","model_id":"deepseek"}'
```

Expected: either successful response or model configuration error. It must not fail with "not authenticated".

**Step 4: Fix only if auth blocks guest**

If either request returns 401 due to missing token, change the route dependency from `get_current_user` to a guest-safe dependency or adjust `get_current_user` to return default guest for missing token. Do not weaken validation for invalid provided JWTs.

**Step 5: Commit if code changed**

```bash
git add backend/src/api/auth.py backend/src/api/translate_routes.py backend/src/api/slides_routes.py
git commit -m "fix: allow guest feature API usage"
```

---

### Task 8: End-To-End Manual QA Matrix

**Files:**
- Create: `docs/plans/homepage-feature-buttons-qa.md`

**Step 1: Start services**

Run:

```bash
cd <repo-root>/backend
langgraph dev --config langgraph.json
```

In another shell:

```bash
cd <repo-root>/frontend
yarn dev
```

**Step 2: Test feature buttons**

Create `docs/plans/homepage-feature-buttons-qa.md` with this matrix and fill results:

```markdown
# Homepage Feature Buttons QA

| Feature | Select button | Select template/style | Visible capsule | Selected card state | Backend receives template instruction | Result acceptable |
|---|---|---|---|---|---|---|
| AI Image | | | | | | |
| Slides | | | | | | |
| Prompt Optimize | | | | | | |
| Fortune Telling | | | | | | |
| Humanize | | | | | | |
| AI Translate | | | | | | |
```

**Step 3: Browser checks**

For each feature:

1. Open `http://localhost:3000`.
2. Click the feature button.
3. Select a template or style if available.
4. Confirm visible feedback.
5. Submit a short input.
6. Confirm output matches selected mode.

**Step 4: Automated smoke checks**

Use Playwright with system Chrome to verify:

```js
await page.goto("http://localhost:3000/");
await page.getByText(/Humanize|去AI化/).first().click();
await page.getByText(/学术论文|Academic Paper/).first().click();
await expect(page.getByText(/学术论文|Academic Paper/).first()).toBeVisible();
```

Repeat for Prompt Optimize, Fortune, AI Image, Slides, and Translate.

**Step 5: Commit QA notes**

```bash
git add docs/plans/homepage-feature-buttons-qa.md
git commit -m "test: document homepage feature button qa"
```

---

### Task 9: Final Verification And Push

**Files:**
- Review all modified files.

**Step 1: Run targeted lint**

```bash
cd <repo-root>/frontend
npx eslint \
  src/app/page.tsx \
  src/data/featureTemplates.ts \
  src/data/featurePrompts.ts \
  src/app/components/FeatureTemplateGrid.tsx \
  src/app/components/TemplateCard.tsx \
  src/app/components/PromptInput.tsx \
  src/app/components/TemplatePromptInput.tsx \
  src/app/components/slides/SlidesExperience.tsx \
  src/app/components/slides/slidecraft/components/Home.tsx \
  src/app/components/slides/slidecraft/components/SlideShow.tsx \
  src/app/components/slides/slidecraft/services/geminiService.ts
```

Expected: no lint errors in touched files.

**Step 2: Run i18n audit**

```bash
yarn i18n:audit
```

Expected: no hard-coded Chinese UI strings in scanned files. Prompt instructions may be English.

**Step 3: Run production build**

```bash
yarn build
```

Expected: build succeeds.

**Step 4: Check for local path leaks**

```bash
cd <repo-root>
rg -n "LOCAL_PRIVATE_ASSET_PATTERN" frontend/src frontend/public/templates docs || true
```

Expected: no product code or public asset metadata leaks local absolute paths. Plan/audit docs should also avoid local personal asset paths unless needed for internal notes.

**Step 5: Check git diff**

```bash
git status --short
git diff --stat
```

Expected: only planned files changed.

**Step 6: Push**

```bash
git push origin main
```

Expected: push succeeds.

**Step 7: Final user-facing report**

Report:

- Every homepage button now has a clear mode.
- Templates have visible selection feedback.
- Template choices feed backend prompts or API request fields.
- AI Image and Slides have real visual previews.
- Humanize, Prompt Optimize, and Fortune have meaningful template descriptions and backend instructions.
- Translate remains style-driven and continues to use the selected language/model path.
