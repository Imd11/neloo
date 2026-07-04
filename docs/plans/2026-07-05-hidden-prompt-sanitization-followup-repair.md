# Hidden Prompt Sanitization Follow-up Repair Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the remaining acceptance gaps in the hidden template prompt sanitization work so hidden template instructions never appear in visible history/share/copy/regenerate flows while template-specific behavior is preserved where the plan requires it.

**Architecture:** Keep the existing hidden prompt envelope design. Add a shared frontend legacy-prefix sanitizer for old runtime/checkpoint messages, rebuild hidden model input only in memory for regenerate, preserve sanitized optimistic UI and persistence, and record the browser regression evidence required by the original plan.

**Tech Stack:** Next.js 16, React 19, TypeScript, LangGraph SDK stream client, FastAPI backend, Python sanitizer tests, existing Neloo feature prompt utilities in `frontend/src/data/featurePrompts.ts` and `frontend/src/data/fortuneTemplatePrefix.ts`.

---

### Task 0: Confirm Scope And Baseline

**Files:**
- Review only: `docs/plans/2026-07-05-hidden-template-prefix-history-sanitization.md`
- Review only: `frontend/src/app/utils/hiddenPromptEnvelope.ts`
- Review only: `frontend/src/app/hooks/useChat.ts`
- Review only: `frontend/src/app/components/ChatMessage.tsx`
- Review only: `frontend/src/app/utils/utils.ts`
- Review only: `backend/src/hidden_prompt_sanitization.py`
- Review only: `docs/plans/hidden-template-prefix-regression-check.md`

**Step 1: Confirm clean git state**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git status --short
git rev-parse HEAD
git rev-parse origin/main
```

Expected: worktree is clean and local `HEAD` equals `origin/main`, unless another concurrent task has intentionally added changes. If unrelated dirty files exist, do not touch them.

**Step 2: Reconfirm the four repair targets**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
rg -n "regenerateLastResponse|createHiddenPromptMessage|getVisibleHumanContent|sanitizeHiddenPromptMessageForPersistence|You are a senior prompt engineer|Act like a professional content writer|Analysis direction:|\\[System: You are now acting as the agent" frontend/src backend/src docs/plans
```

Expected: confirm these current gaps:

- regenerate submits sanitized messages only, so template behavior is lost.
- frontend display has no legacy hidden-prefix stripper for old LangGraph/checkpoint messages without envelope metadata.
- browser regression checklist exists but no execution results are recorded.
- old process plan docs still contain full hidden prompt strings outside the allowed source/checklist locations.

**Step 3: Commit planning document if it is the only new file**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git add docs/plans/2026-07-05-hidden-prompt-sanitization-followup-repair.md
git commit -m "docs: plan hidden prompt sanitization follow-up"
```

Expected: the repair plan is preserved separately from code changes.

---

### Task 1: Add Frontend Legacy Hidden-Prefix Sanitizer Coverage

**Files:**
- Modify: `frontend/src/app/utils/hiddenPromptEnvelope.ts`
- Create or modify: `frontend/src/app/utils/hiddenPromptEnvelope.test.ts` only if the existing frontend test setup supports it
- If no frontend test harness exists, create: `frontend/scripts/check-hidden-prompt-envelope.mjs`

**Step 1: Inspect frontend test tooling**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
cat package.json
rg -n "vitest|jest|tsx|ts-node|node --test" package.json src scripts
```

Expected: decide whether to add a normal frontend unit test or a small Node-based verification script. Prefer the existing test runner if present. Do not add a new test framework.

**Step 2: Write failing frontend sanitizer checks**

If an existing TypeScript test runner exists, add tests covering:

```ts
import {
  getVisibleHumanContent,
  sanitizeLegacyHiddenPromptContent,
} from "@/app/utils/hiddenPromptEnvelope";

it("strips legacy prompt optimize prefixes from human messages without an envelope", () => {
  const content =
    "You are a senior prompt engineer.\n\n" +
    "- Do not answer the user's task. Only return the improved prompt." +
    "make a hero prompt";

  expect(sanitizeLegacyHiddenPromptContent(content)).toBe("make a hero prompt");
});

it("strips legacy fortune prefixes from human messages without an envelope", () => {
  expect(
    getVisibleHumanContent({
      id: "m1",
      type: "human",
      content: "Analysis direction: Career.\n\nUser information:\n1990-01-01",
    } as any)
  ).toBe("1990-01-01");
});

it("does not alter normal human messages", () => {
  expect(sanitizeLegacyHiddenPromptContent("hello world")).toBe("hello world");
});
```

If no frontend test runner exists, create `frontend/scripts/check-hidden-prompt-envelope.mjs` that imports or reimplements only enough compiled logic to assert the same cases. Keep it deterministic and local.

Expected before implementation: the new check fails because the frontend has no legacy prefix sanitizer.

**Step 3: Run the failing check**

Use the command discovered in Step 1. Examples:

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
npx vitest run src/app/utils/hiddenPromptEnvelope.test.ts
```

or:

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
node scripts/check-hidden-prompt-envelope.mjs
```

Expected: FAIL for legacy prefix cleaning.

**Step 4: Implement minimal frontend legacy sanitizer**

Modify `frontend/src/app/utils/hiddenPromptEnvelope.ts`:

```ts
const LEGACY_HIDDEN_PREFIX_MARKERS = [
  "You are a senior prompt engineer.",
  "Act like a professional content writer",
  "Analysis direction:",
  "[System: You are now acting as the agent",
] as const;

const LEGACY_VISIBLE_CONTENT_MARKERS = [
  "\nUser information:\n",
  "\nRewrite the user's text. Return only the rewritten text.",
  "\n- Do not answer the user's task. Only return the improved prompt.",
  "\n---\nUser message:]\n",
] as const;

export function sanitizeLegacyHiddenPromptContent(content: string): string {
  const stripped = content.trimStart();
  if (!LEGACY_HIDDEN_PREFIX_MARKERS.some((marker) => stripped.startsWith(marker))) {
    return content;
  }

  for (const marker of LEGACY_VISIBLE_CONTENT_MARKERS) {
    const markerIndex = stripped.indexOf(marker);
    if (markerIndex >= 0) {
      return stripped.slice(markerIndex + marker.length).trimStart();
    }
  }

  return content;
}
```

Then update `getVisibleHumanContent` fallback:

```ts
return typeof message.content === "string"
  ? sanitizeLegacyHiddenPromptContent(message.content)
  : null;
```

Expected: old human messages without `additional_kwargs.neloo_hidden_prompt` are safely displayed with only visible user content when they match known Neloo prefixes.

**Step 5: Run sanitizer checks**

Run the same command from Step 3.

Expected: PASS.

**Step 6: Run targeted lint**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
npx eslint src/app/utils/hiddenPromptEnvelope.ts
```

If a test/script file was added, include it in lint only if the repo lint config supports that file type.

Expected: no new lint errors.

**Step 7: Commit**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git add frontend/src/app/utils/hiddenPromptEnvelope.ts frontend/src/app/utils/hiddenPromptEnvelope.test.ts frontend/scripts/check-hidden-prompt-envelope.mjs
git commit -m "fix: strip legacy hidden prompts in frontend display"
```

Expected: commit contains only frontend sanitizer test/check and implementation.

---

### Task 2: Preserve Template Behavior During Regenerate Without Persisting Hidden Text

**Files:**
- Modify: `frontend/src/app/hooks/useChat.ts`
- Modify: `frontend/src/app/utils/hiddenPromptEnvelope.ts`
- Test or check: same frontend test/check file from Task 1 if practical

**Step 1: Add helper to rebuild model-facing hidden prompt messages**

Modify `frontend/src/app/utils/hiddenPromptEnvelope.ts` to export a helper that takes a sanitized visible message plus a hidden prompt envelope and returns a model-facing message:

```ts
export function createModelFacingHiddenPromptMessage(
  message: Message,
  envelope: HiddenPromptEnvelope
): Message {
  const messageId = message.id;
  if (!messageId) return message;
  return createHiddenPromptMessage(messageId, envelope);
}
```

If this wrapper adds no value after implementation inspection, use `createHiddenPromptMessage` directly in `useChat.ts`. Do not add abstraction just for its own sake.

Expected: code path can build hidden model input in memory while keeping optimistic UI sanitized.

**Step 2: Add a local rebuild function in `useChat.ts`**

In `frontend/src/app/hooks/useChat.ts`, add a small local function near regenerate logic:

```ts
function rebuildModelMessageForRegenerate(message: Message): Message {
  if (message.type !== "human" || !message.id) return message;

  const additional = (message as Message & {
    additional_kwargs?: Record<string, unknown>;
  }).additional_kwargs;
  const payload = additional?.neloo_hidden_prompt;
  if (!payload || typeof payload !== "object") return message;

  const visibleContent = getVisibleHumanContent(message);
  const context = (payload as { context?: unknown }).context;
  if (!visibleContent || !context || typeof context !== "object") return message;

  const feature = (context as { feature?: unknown }).feature;
  const templateId = (context as { templateId?: unknown }).templateId;

  if (feature === "prompt-optimize") {
    return createHiddenPromptMessage(message.id, {
      visibleContent,
      hiddenPrefix: getPromptOptimizePrompt(
        typeof templateId === "number" ? templateId : null,
        undefined
      ),
      context: { feature: "prompt-optimize", templateId: typeof templateId === "number" ? templateId : undefined },
    });
  }

  if (feature === "deai") {
    return createHiddenPromptMessage(message.id, {
      visibleContent,
      hiddenPrefix: getHumanizePrompt(
        typeof templateId === "number" ? templateId : null,
        undefined
      ),
      context: { feature: "deai", templateId: typeof templateId === "number" ? templateId : undefined },
    });
  }

  if (feature === "fortune") {
    return createHiddenPromptMessage(message.id, {
      visibleContent,
      hiddenPrefix: getFortuneTemplatePrefix(typeof templateId === "number" ? templateId : 1),
      context: { feature: "fortune", templateId: typeof templateId === "number" ? templateId : 1 },
    });
  }

  return message;
}
```

Adjust imports as needed:

```ts
import { getHumanizePrompt, getPromptOptimizePrompt } from "@/data/featurePrompts";
import { getFortuneTemplatePrefix } from "@/data/fortuneTemplatePrefix";
import { getVisibleHumanContent, createHiddenPromptMessage, ... } from "@/app/utils/hiddenPromptEnvelope";
```

Important rule: do not support agent regenerate unless a safe non-secret rebuild path exists. If `agent` context does not include a non-secret system prompt source, keep visible-only regenerate for agent messages rather than storing or reconstructing hidden agent prompt from persisted data.

Expected: known template features can preserve model behavior during regenerate; active-agent regenerate remains safe and non-leaking.

**Step 3: Update `regenerateLastResponse`**

Replace:

```ts
const truncatedMessages = sanitizeHiddenPromptMessagesForPersistence(
  currentMessages.slice(0, lastHumanIndex + 1)
);

stream.submit(
  { messages: truncatedMessages },
  {
    optimisticValues: { messages: truncatedMessages },
    config: { ...(activeAssistant?.config ?? {}), recursion_limit: 1000 },
  }
);
```

with:

```ts
const sanitizedMessages = sanitizeHiddenPromptMessagesForPersistence(
  currentMessages.slice(0, lastHumanIndex + 1)
);
const modelMessages = sanitizedMessages.map((message, index) =>
  index === sanitizedMessages.length - 1
    ? rebuildModelMessageForRegenerate(message)
    : message
);

stream.submit(
  { messages: modelMessages },
  {
    optimisticValues: { messages: sanitizedMessages },
    config: { ...(activeAssistant?.config ?? {}), recursion_limit: 1000 },
  }
);
```

Expected: the model receives the rebuilt hidden prefix only for the last human message, while UI and persistence remain sanitized.

**Step 4: Keep `editMessageAndRerun` safe**

Leave `editMessageAndRerun` visible-only unless the user is currently in the same explicit feature mode and the hidden prefix can be rebuilt from current UI state. Do not infer old hidden prompts from persisted text.

Expected: editing a message cannot accidentally reintroduce hidden prefix text.

**Step 5: Add/extend frontend checks if practical**

If the existing frontend check from Task 1 can validate this without brittle React hook testing, add a small pure helper test. If doing so requires a new testing framework or heavy hook harness, skip and rely on browser regression in Task 5.

Expected: no over-engineered test setup.

**Step 6: Run targeted lint**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
npx eslint src/app/hooks/useChat.ts src/app/utils/hiddenPromptEnvelope.ts
```

Expected: no lint errors.

**Step 7: Run production type/build check**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
yarn build
```

Expected: build passes. Existing warnings about baseline browser mapping, Browserslist, or Next middleware convention may remain if they are unrelated.

**Step 8: Commit**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git add frontend/src/app/hooks/useChat.ts frontend/src/app/utils/hiddenPromptEnvelope.ts frontend/src/app/utils/hiddenPromptEnvelope.test.ts frontend/scripts/check-hidden-prompt-envelope.mjs
git commit -m "fix: preserve template prompts during regenerate"
```

Expected: commit contains only regenerate behavior and related tests/checks.

---

### Task 3: Remove Old Process Docs That Violate The Hidden Prompt Search Acceptance Rule

**Files:**
- Delete: `docs/plans/2026-07-02-homepage-feature-actions-completion.md`
- Delete: `docs/plans/2026-07-04-homepage-feature-buttons-completion.md`

**Step 1: Confirm these are process docs, not required product docs**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
sed -n '1,80p' docs/plans/2026-07-02-homepage-feature-actions-completion.md
sed -n '1,80p' docs/plans/2026-07-04-homepage-feature-buttons-completion.md
rg -n "2026-07-02-homepage-feature-actions-completion|2026-07-04-homepage-feature-buttons-completion" .
```

Expected: documents are internal process/plan docs and are not referenced by runtime code, README, or configuration.

**Step 2: Delete the old process docs**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
rm docs/plans/2026-07-02-homepage-feature-actions-completion.md
rm docs/plans/2026-07-04-homepage-feature-buttons-completion.md
```

Expected: full hidden prompt examples are removed from obsolete process docs.

**Step 3: Re-run hidden prompt string search**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
rg -n "You are a senior prompt engineer\\.|Act like a professional content writer|Analysis direction:|\\[System: You are now acting as the agent" frontend/src backend/src docs/plans
```

Expected: matches are limited to active source prompt definitions, sanitizer logic, tests, the active implementation plan, and the regression checklist. There should be no obsolete process docs with full prompt bodies.

**Step 4: Commit**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git add -u docs/plans
git commit -m "docs: remove obsolete hidden prompt process docs"
```

Expected: commit deletes only the obsolete process docs.

---

### Task 4: Strengthen Backend Sanitizer Tests For Legacy And Envelope Cases

**Files:**
- Modify: `backend/tests/test_hidden_prompt_sanitization.py`
- Modify only if needed: `backend/src/hidden_prompt_sanitization.py`

**Step 1: Add tests for agent and humanize legacy prefixes**

Append tests:

```python
def test_sanitize_legacy_agent_prefix_best_effort():
    message = {
        "id": "msg-agent",
        "type": "human",
        "content": (
            "[System: You are now acting as the agent \"Writer\". Follow these instructions:\n"
            "secret agent instruction"
            "\n---\nUser message:]\n"
            "draft this email"
        ),
    }

    sanitized = sanitize_hidden_prompt_message_data(message)

    assert sanitized["content"] == "draft this email"


def test_sanitize_legacy_humanize_prefix_best_effort():
    message = {
        "id": "msg-humanize",
        "type": "human",
        "content": (
            "Act like a professional content writer and communication strategist.\n\n"
            "Rewrite the user's text. Return only the rewritten text."
            "make this sound natural"
        ),
    }

    sanitized = sanitize_hidden_prompt_message_data(message)

    assert sanitized["content"] == "make this sound natural"
```

Expected before implementation: agent should already pass; humanize may fail depending on exact marker spacing.

**Step 2: Run tests**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/backend
python3.13 -m pytest tests/test_hidden_prompt_sanitization.py -q
```

Expected: tests pass or reveal a narrow marker mismatch.

**Step 3: Fix sanitizer only if tests reveal a real gap**

If humanize fails because marker spacing differs, update `backend/src/hidden_prompt_sanitization.py` conservatively by adding only the observed marker variant:

```python
"\nRewrite the user's text. Return only the rewritten text.",
"Rewrite the user's text. Return only the rewritten text.",
```

Do not add broad regex stripping that could alter ordinary user text.

**Step 4: Re-run tests and compile**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/backend
python3.13 -m pytest tests/test_hidden_prompt_sanitization.py -q
python3 -m compileall src
```

Expected: all tests pass and backend compiles.

**Step 5: Commit**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git add backend/tests/test_hidden_prompt_sanitization.py backend/src/hidden_prompt_sanitization.py
git commit -m "test: cover legacy hidden prompt sanitization"
```

Expected: commit includes only backend tests and any minimal sanitizer adjustment.

---

### Task 5: Run And Record Required Browser Regression Evidence

**Files:**
- Modify: `docs/plans/hidden-template-prefix-regression-check.md`

**Step 1: Start or confirm local backend and frontend**

Run commands appropriate for this repo. First inspect scripts:

```bash
cd /Users/yang/Desktop/agent/neloo
cat frontend/package.json
cat backend/pyproject.toml
```

Then start existing dev commands in separate terminals or background sessions. Use the repo's established commands and ports. Do not invent a new dev workflow.

Expected: frontend and backend are reachable locally.

**Step 2: Execute checklist manually in browser**

Open the local app and complete every item in:

```bash
/Users/yang/Desktop/agent/neloo/docs/plans/hidden-template-prefix-regression-check.md
```

Required checks:

- Prompt Optimize visible bubble after submit.
- Prompt Optimize visible bubble after refresh.
- Humanize visible bubble and history.
- Fortune visible bubble and history.
- Regenerate does not display hidden prompt and still uses the selected template behavior where observable.
- Fork/regenerate thread does not display hidden prompt.
- Share page does not display hidden prompt.
- Network/API response for history and share does not expose hidden prompt in human `content`.

If a paid model call or missing API key blocks a step, do not fake completion. Record the blocker and run the closest non-paid/API-level substitute.

Expected: no hidden prompt appears in visible UI or returned human `content`.

**Step 3: Record results in the checklist**

Append a section to `docs/plans/hidden-template-prefix-regression-check.md`:

```markdown
## Execution Results - 2026-07-05

- Frontend URL: `<actual URL>`
- Backend URL: `<actual URL>`
- Prompt Optimize submit: PASS/FAIL, notes
- Prompt Optimize refresh/history response: PASS/FAIL, notes
- Humanize submit/history: PASS/FAIL, notes
- Fortune submit/history: PASS/FAIL, notes
- Regenerate: PASS/FAIL, notes
- Fork/regenerate: PASS/FAIL, notes
- Share page/API: PASS/FAIL, notes
- DB spot check: PASS/FAIL/SKIPPED, notes
- Blockers or skipped checks: `<none or concrete reason>`
```

Expected: there is concrete acceptance evidence instead of only an unexecuted checklist.

**Step 4: Commit**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git add docs/plans/hidden-template-prefix-regression-check.md
git commit -m "test: record hidden prompt regression results"
```

Expected: verification evidence is committed.

---

### Task 6: Final Verification Before Push

**Files:**
- Verify only: frontend and backend

**Step 1: Run frontend verification**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
npx eslint src/app/hooks/useChat.ts src/app/page.tsx src/app/components/ChatMessage.tsx src/app/utils/utils.ts src/app/utils/hiddenPromptEnvelope.ts
yarn i18n:audit
yarn build
```

Expected: all pass. Existing unrelated dependency warnings are acceptable only if documented in final response.

**Step 2: Run backend verification**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/backend
python3.13 -m pytest tests/test_hidden_prompt_sanitization.py -q
python3 -m compileall src
```

Expected: sanitizer tests pass and backend compiles.

**Step 3: Run hidden prompt string search**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
rg -n "You are a senior prompt engineer\\.|Act like a professional content writer|Analysis direction:|\\[System: You are now acting as the agent" frontend/src backend/src docs/plans
```

Expected: matches are explainable and limited to active source definitions, sanitizer/test code, this repair plan, and the active checklist. No old generated/process docs should contain full prompt bodies.

**Step 4: Confirm clean git state and recent commits**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git status --short
git log --oneline -10
```

Expected: worktree is clean and recent commits match this plan.

---

### Task 7: Push To GitHub Main

**Files:**
- Verify only: git state

**Step 1: Push**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git push origin main
```

Expected: push succeeds.

**Step 2: Final user-facing report**

Report:

- The exact verification commands that passed.
- Whether the browser regression checklist passed fully or which items were skipped with concrete reasons.
- The final user-visible behavior:
  - Hidden template instructions are never shown in chat bubbles, history reload, copy, share, regenerate, or fork/regenerate.
  - Prompt Optimize / Humanize / Fortune still keep their template behavior on normal send and regenerate.
  - Old known Neloo hidden prefixes are stripped best-effort when displayed or returned by backend history/share.
- The pushed commit range or latest commit hash.

