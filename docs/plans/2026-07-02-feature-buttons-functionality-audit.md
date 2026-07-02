# Feature Buttons Functionality Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Verify whether the six homepage feature buttons are functionally usable end-to-end, without modifying application code.

**Architecture:** This is an audit-only plan. The executor will trace each button from static frontend configuration through runtime UI behavior, request payloads, backend routes, configuration dependencies, and visible user outcomes. Any bug found should be documented with evidence and a separate fix recommendation, not fixed during this plan.

**Tech Stack:** Next.js 16 frontend, React components, LangGraph backend on port `2024`, local Next dev server on `3001`, browser DevTools or Playwright-style browser automation, shell tools (`rg`, `curl`, `lsof`), Git diff/status.

---

## Non-Negotiable Scope

- Do not modify code.
- Do not reformat files.
- Do not update dependencies.
- Do not change environment variables.
- Do not push to GitHub.
- Produce an evidence-based audit report only.

Buttons to audit:

1. `AI Image`
2. `Slides`
3. `Prompt Optimize`
4. `Fortune Telling`
5. `Humanize`
6. `AI Translate`

Definition of "usable":

- The button can be clicked.
- The UI changes in a way the user can understand.
- The selected feature affects the next submit action.
- The submit action reaches the intended frontend service or backend route.
- Required API keys or environment variables are either configured or surfaced clearly as missing.
- Success and failure states are visible and recoverable.
- The user is not left in a silent failure, endless loading state, broken route, or unrelated generic chat flow.

## Audit Output

Create one report:

- Create: `docs/feature-buttons-functionality-audit.md`

Report template:

```markdown
# Feature Buttons Functionality Audit

Date: 2026-07-02
Frontend URL: http://localhost:3001/
Backend URL: http://127.0.0.1:2024/

## Summary

| Button | Verdict | Frontend Path | Backend/API Path | Main Risk |
|---|---|---|---|---|
| AI Image | pass / partial / fail / pseudo-entry | ... | ... | ... |
| Slides | pass / partial / fail / pseudo-entry | ... | ... | ... |
| Prompt Optimize | pass / partial / fail / pseudo-entry | ... | ... | ... |
| Fortune Telling | pass / partial / fail / pseudo-entry | ... | ... | ... |
| Humanize | pass / partial / fail / pseudo-entry | ... | ... | ... |
| AI Translate | pass / partial / fail / pseudo-entry | ... | ... | ... |

## Detailed Findings

### AI Image

- Static chain:
- Runtime behavior:
- Network/API evidence:
- Required config:
- User-visible result:
- Verdict:
- Fix recommendation, if needed:

Repeat for each button.

## Environment and Config Dependencies

| Feature | Required Variables | Current Local Status | Missing Config UX |
|---|---|---|---|

## Open Risks

## Recommended Fix Plan
```

---

### Task 1: Confirm Runtime Baseline

**Files:**
- Read: `/Users/yang/Desktop/agent/neloo/frontend/package.json`
- Read: `/Users/yang/Desktop/agent/neloo/backend/langgraph.json`
- Create: `/Users/yang/Desktop/agent/neloo/docs/feature-buttons-functionality-audit.md`

**Step 1: Confirm frontend port**

Run:

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

Expected:

- A `node` process is listening on `*:3001`.

**Step 2: Confirm backend port**

Run:

```bash
lsof -nP -iTCP:2024 -sTCP:LISTEN
```

Expected:

- A Python/LangGraph process is listening on `127.0.0.1:2024`.

**Step 3: Confirm homepage response**

Run:

```bash
curl -I --max-time 10 http://localhost:3001/
```

Expected:

- `HTTP/1.1 200 OK`.

**Step 4: Start audit report**

Create `docs/feature-buttons-functionality-audit.md` from the report template above.

**Step 5: Record baseline**

Add frontend URL, backend URL, process status, and timestamp to the report.

---

### Task 2: Map Static Button Definitions

**Files:**
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/data/featureTemplates.ts`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/FeatureButtons.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/page.tsx`
- Update report only: `/Users/yang/Desktop/agent/neloo/docs/feature-buttons-functionality-audit.md`

**Step 1: Locate the six feature entries**

Run:

```bash
rg -n "AI Image|Slides|Prompt Optimize|Fortune Telling|Humanize|AI Translate" frontend/src/data/featureTemplates.ts
```

Expected:

- Six feature definitions are found.

**Step 2: Extract each feature's metadata**

For each feature, record:

- `id`
- `title`
- `description`
- `templates`
- any routing or mode fields
- any icon/label localization behavior

**Step 3: Trace button rendering**

Read `FeatureButtons.tsx` and record:

- how features are filtered
- how selected state is displayed
- what `onSelectFeature` receives

**Step 4: Trace homepage state handling**

Read `page.tsx` and record:

- `selectedFeature`
- `setActiveFeatureId`
- `setFortuneMode`
- `enableWebDevMode`
- `onEnterSlidesEditMode`
- submit behavior in `LandingView`

**Step 5: Update report**

For each button, add its static frontend chain:

```text
featureTemplates.ts -> FeatureButtons.tsx -> page.tsx -> submit handler
```

---

### Task 3: Map Submit and Input Behavior

**Files:**
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/PromptInput.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/TemplatePromptInput.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/ChatPromptInput.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/ChatInterface.tsx`
- Update report only: `/Users/yang/Desktop/agent/neloo/docs/feature-buttons-functionality-audit.md`

**Step 1: Trace selected feature into the input**

Run:

```bash
rg -n "selectedFeature|activeFeatureId|onPromptSubmit|onSubmit|TemplatePromptInput|PromptInput" frontend/src/app/components frontend/src/app/page.tsx
```

Expected:

- The selected feature is passed to the input or submit path.

**Step 2: Identify feature-specific behavior**

For each feature, answer:

- Does clicking the button only change placeholder text?
- Does it inject a template?
- Does it change mode?
- Does it change route?
- Does it change the API payload?

**Step 3: Record submit payload fields**

Record whether the payload contains:

- `model`
- `threadId`
- `mode`
- `featureId`
- `prompt`
- `files`
- `image` or `slides`-specific fields

**Step 4: Update report**

Add a "Submit Behavior" subsection for each button.

---

### Task 4: Audit `AI Image`

**Files:**
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/lib/services/image-generator.ts`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/image/page.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/chat/ImageChatPanel.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/data/featureTemplates.ts`
- Update report only: `/Users/yang/Desktop/agent/neloo/docs/feature-buttons-functionality-audit.md`

**Step 1: Static chain**

Trace:

```text
AI Image button -> selected feature -> submit -> image page/panel/service
```

**Step 2: Config dependency check**

Run:

```bash
rg -n "NEXT_PUBLIC_IMAGE_API_URL|NEXT_PUBLIC_IMAGE_API_KEY|NEXT_PUBLIC_TUZI|IMAGE_API|IMAGE_MODEL|generateImage" frontend/src backend/src .env* frontend/.env* backend/.env* 2>/dev/null
```

Expected:

- Required image API key and URL names are identified.

**Step 3: Runtime click test**

In the browser:

1. Open `http://localhost:3001/`.
2. Click `AI Image`.
3. Observe selected state and placeholder.
4. Submit: `A minimal flat icon of a calendar, white background`.

**Step 4: Capture evidence**

Record:

- visible UI state after click
- network request URL
- response status
- console errors, if any
- whether generated image appears
- missing key message, if any

**Step 5: Verdict**

Classify as:

- `pass`
- `partial`
- `fail`
- `pseudo-entry`

---

### Task 5: Audit `Slides`

**Files:**
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/page.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/slides/SlidesExperience.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/slides/OutlineEditor.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/slides/SlideShow.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/slides/slidecraft/services/geminiService.ts`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/slides/lib/slidesService.ts`
- Update report only: `/Users/yang/Desktop/agent/neloo/docs/feature-buttons-functionality-audit.md`

**Step 1: Static chain**

Trace:

```text
Slides button -> selected feature -> LandingView submit -> onEnterSlidesEditMode -> SlidesExperience
```

**Step 2: Config dependency check**

Run:

```bash
rg -n "NEXT_PUBLIC_DEEPSEEK_API_KEY|NEXT_PUBLIC_TUZI_IMAGE_API_KEY|NEXT_PUBLIC_TUZI_API_KEY|NEXT_PUBLIC_QWEN|slides|pptx|gemini" frontend/src backend/src frontend/.env* backend/.env* .env* 2>/dev/null
```

Expected:

- Required text and image generation keys for slides are identified.

**Step 3: Runtime click test**

In the browser:

1. Click `Slides`.
2. Submit: `Create a 3-slide deck about open-source AI agents`.
3. Observe whether it enters outline or slide generation mode.

**Step 4: Capture evidence**

Record:

- whether a slides editor replaces the chat landing page
- whether outline generation starts
- whether image generation starts
- whether export controls appear
- any request failures
- whether missing config is visible

**Step 5: Verdict**

Classify and document the reason.

---

### Task 6: Audit `Prompt Optimize`

**Files:**
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/data/featureTemplates.ts`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/page.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/ChatInterface.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/backend/src/api/agent_routes.py`
- Read: `/Users/yang/Desktop/agent/neloo/backend/src/api/webapp.py`
- Update report only: `/Users/yang/Desktop/agent/neloo/docs/feature-buttons-functionality-audit.md`

**Step 1: Static chain**

Determine whether this button:

- injects a template into the input
- changes the submit message only
- calls `/generate-prompt`
- calls ordinary chat

**Step 2: Runtime click test**

In the browser:

1. Click `Prompt Optimize`.
2. Submit: `Write a prompt for a coding assistant that reviews pull requests`.

**Step 3: Capture evidence**

Record:

- input placeholder
- selected button state
- request endpoint
- final response
- whether response is a prompt optimization result or generic chat

**Step 4: Verdict**

If it only changes the prompt/template but still works as a prompt optimizer through chat, classify as `partial` unless the UI clearly explains that behavior.

---

### Task 7: Audit `Fortune Telling`

**Files:**
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/data/featureTemplates.ts`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/page.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/ChatInterface.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/backend/src/agent/graph.py`
- Read: `/Users/yang/Desktop/agent/neloo/backend/src/api/webapp.py`
- Update report only: `/Users/yang/Desktop/agent/neloo/docs/feature-buttons-functionality-audit.md`

**Step 1: Static chain**

Trace:

```text
Fortune Telling button -> setFortuneMode -> model/graph id or mode -> backend FORTUNE_PROMPT
```

**Step 2: Backend graph check**

Run:

```bash
rg -n "FORTUNE_PROMPT|fortune|setFortuneMode|fortuneMode|mode" frontend/src backend/src
```

Expected:

- A frontend mode flag and backend fortune graph/prompt are connected.

**Step 3: Runtime click test**

In the browser:

1. Click `Fortune Telling`.
2. Submit: `I was born on 1996-05-12 at 08:30 in Shanghai. Please analyze my BaZi.`

**Step 4: Capture evidence**

Record:

- whether mode indicator changes
- request payload graph/model/mode
- whether backend uses `*-fortune` or equivalent
- whether response follows fortune-telling behavior
- whether missing birth info causes clarifying questions

**Step 5: Verdict**

Classify and document whether the feature is genuinely separate from generic chat.

---

### Task 8: Audit `Humanize`

**Files:**
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/data/featureTemplates.ts`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/page.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/ChatInterface.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/backend/src/api/webapp.py`
- Update report only: `/Users/yang/Desktop/agent/neloo/docs/feature-buttons-functionality-audit.md`

**Step 1: Static chain**

Determine whether `Humanize`:

- has templates only
- modifies the submitted user prompt
- calls a dedicated backend route
- calls ordinary chat with a feature template

**Step 2: Runtime click test**

In the browser:

1. Click `Humanize`.
2. Submit: `Please rewrite this to sound natural: We are in receipt of your request and will process it accordingly.`

**Step 3: Capture evidence**

Record:

- selected state
- endpoint and payload
- whether output is actually humanized
- whether language is preserved
- whether user can understand what happened

**Step 4: Verdict**

If the feature is template-driven but usable, classify as `partial` unless UI and output make the mode clear.

---

### Task 9: Audit `AI Translate`

**Files:**
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/data/featureTemplates.ts`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/TranslatePanel.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/backend/src/api/translate_routes.py`
- Read: `/Users/yang/Desktop/agent/neloo/backend/src/api/webapp.py`
- Update report only: `/Users/yang/Desktop/agent/neloo/docs/feature-buttons-functionality-audit.md`

**Step 1: Static chain**

Determine whether `AI Translate`:

- opens `TranslatePanel`
- injects a template
- calls `/api/translate`
- calls ordinary chat

**Step 2: Config dependency check**

Run:

```bash
rg -n "translate|STYLE_PROMPTS|OPENAI_API_KEY|DEEPSEEK_API_KEY|QWEN_API_KEY|ANTHROPIC_API_KEY" frontend/src backend/src frontend/.env* backend/.env* .env* 2>/dev/null
```

Expected:

- The model/provider required for translation is identified.

**Step 3: Runtime click test**

In the browser:

1. Click `AI Translate`.
2. Submit: `Translate into English: 这个项目是一个通用智能体。`

**Step 4: Capture evidence**

Record:

- whether translation mode is obvious
- request endpoint
- style/target-language handling
- translated output quality
- missing config handling

**Step 5: Verdict**

Classify and document whether it is a real translation feature or generic chat.

---

### Task 10: Cross-Feature Regression Checks

**Files:**
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/page.tsx`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/src/app/components/FeatureButtons.tsx`
- Update report only: `/Users/yang/Desktop/agent/neloo/docs/feature-buttons-functionality-audit.md`

**Step 1: Switching behavior**

In the browser:

1. Click each feature button in sequence.
2. Confirm only one feature is selected at a time.
3. Confirm clicking `New Chat` clears feature-specific mode if intended.

**Step 2: Mode reset behavior**

Check whether these states reset correctly:

- `selectedFeature`
- `fortuneMode`
- `webDevMode`
- `slidesEditMode`
- uploaded files
- active template

**Step 3: Language behavior**

With language set to English, confirm:

- feature labels are English
- visible mode-specific helper text is English
- model-generated responses are not forced into Chinese by hardcoded prompts

**Step 4: Report shared issues**

Add cross-feature risks, such as:

- feature buttons are only templates and not real feature modes
- missing config produces silent failure
- selected feature does not affect submit
- mode remains stuck after switching

---

### Task 11: Environment Dependency Matrix

**Files:**
- Read: `/Users/yang/Desktop/agent/neloo/backend/.env.example`
- Read: `/Users/yang/Desktop/agent/neloo/frontend/.env.local` if present
- Read: `/Users/yang/Desktop/agent/neloo/backend/.env` if present, without copying secret values into the report
- Read: `/Users/yang/Desktop/agent/neloo/docs/configuration.md`
- Update report only: `/Users/yang/Desktop/agent/neloo/docs/feature-buttons-functionality-audit.md`

**Step 1: Build variable list**

Run:

```bash
rg -n "process\\.env|os\\.getenv|NEXT_PUBLIC_|API_KEY|BASE_URL|DATABASE_URL" frontend/src backend/src backend/.env.example frontend/.env* backend/.env* .env* docs/configuration.md 2>/dev/null
```

**Step 2: Map variables to features**

For each button, list:

- model API key variables
- base URL variables
- database/storage variables
- image generation variables
- optional service variables

**Step 3: Check local presence safely**

Do not print secret values. Only record `configured` or `missing`.

Example command:

```bash
node -e 'for (const k of ["NEXT_PUBLIC_IMAGE_API_KEY","NEXT_PUBLIC_TUZI_API_KEY"]) console.log(k, process.env[k] ? "configured" : "missing")'
```

Use shell environment only; do not echo `.env` values into the report.

**Step 4: Update report**

Add the dependency matrix and explain which features cannot be fully tested because a key is missing.

---

### Task 12: Final Classification and Recommendations

**Files:**
- Update report only: `/Users/yang/Desktop/agent/neloo/docs/feature-buttons-functionality-audit.md`

**Step 1: Assign verdicts**

Use these exact verdicts:

- `pass`: end-to-end usable and clear.
- `partial`: works only through a generic/template path, or has unclear UX, but produces the intended output.
- `fail`: cannot complete the intended function.
- `pseudo-entry`: button has UI presence but no real function-specific behavior.

**Step 2: Prioritize risks**

Group findings:

- P0: clicking or submitting breaks the app.
- P1: feature appears available but cannot work because config or route is missing.
- P2: feature works but UX is misleading.
- P3: copy, localization, or polish issues.

**Step 3: Write fix recommendations**

For every non-`pass` feature, write:

- root cause
- recommended minimal fix
- files likely involved
- verification needed after fix

Do not implement fixes.

**Step 4: Final answer**

After the report is complete, summarize:

- which buttons are usable
- which are not
- what the top risks are
- whether the homepage feature row can be considered production-ready

---

## Verification Before Completion

Run:

```bash
test -f docs/feature-buttons-functionality-audit.md
rg -n "AI Image|Slides|Prompt Optimize|Fortune Telling|Humanize|AI Translate|Verdict|Required Variables" docs/feature-buttons-functionality-audit.md
```

Expected:

- The report exists.
- All six buttons have detailed entries.
- Each entry has a verdict and evidence.

## Commit Policy

Do not commit during this audit unless the user explicitly asks for a commit. This plan is intentionally audit-only.
