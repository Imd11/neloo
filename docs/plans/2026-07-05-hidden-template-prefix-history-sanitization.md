# Hidden Template Prefix History Sanitization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent hidden feature-template prompts from leaking into visible chat history, reloads, share views, copy/edit/regenerate/fork flows, while preserving template-specific model behavior.

**Architecture:** Separate user-visible message content from model-facing hidden instructions. The frontend should submit hidden instructions only as transient model input, attach a small non-secret feature/template context marker, and persist only the visible user content. Backend persistence should defensively sanitize human messages before writing them to chat history.

**Tech Stack:** Next.js 16, React 19, TypeScript, LangGraph SDK stream client, FastAPI backend, existing feature prompt utilities in `frontend/src/data/featurePrompts.ts` and `frontend/src/data/fortuneTemplatePrefix.ts`.

---

### Task 0: Confirm Baseline And Scope

**Files:**
- Review only: `frontend/src/app/hooks/useChat.ts`
- Review only: `frontend/src/app/page.tsx`
- Review only: `frontend/src/app/components/ChatMessage.tsx`
- Review only: `backend/src/agent/persistence_middleware.py`
- Review only: `backend/src/api/webapp.py`

**Step 1: Confirm the current git state**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git status --short
git rev-parse HEAD
git rev-parse origin/main
```

Expected: identify any unrelated dirty files before editing. Do not touch unrelated work.

**Step 2: Reconfirm the bug path**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
rg -n "hiddenPrefix|backendContent|persistUnsavedMessages|abefore_agent|_persist_human_message|_load_db_messages_for_history" frontend/src/app/hooks/useChat.ts backend/src/agent/persistence_middleware.py backend/src/api/webapp.py
```

Expected: confirm that `hiddenPrefix` is prepended to the same human message content and that backend middleware persists human messages.

**Step 3: Commit only if there is a clean planning baseline**

If this plan file is the only new file:

```bash
git add docs/plans/2026-07-05-hidden-template-prefix-history-sanitization.md
git commit -m "docs: plan hidden prompt history sanitization"
```

Expected: plan is preserved separately from code changes.

---

### Task 1: Add A Shared Hidden Prompt Envelope Utility

**Files:**
- Create: `frontend/src/app/utils/hiddenPromptEnvelope.ts`
- Modify: `frontend/src/app/hooks/useChat.ts`

**Step 1: Create the utility**

Create `frontend/src/app/utils/hiddenPromptEnvelope.ts`:

```ts
import type { Message } from "@langchain/langgraph-sdk";

export type HiddenPromptFeature = "fortune" | "prompt-optimize" | "deai" | "agent";

export interface HiddenPromptContext {
  feature: HiddenPromptFeature;
  templateId?: number;
  agentName?: string;
}

export interface HiddenPromptEnvelope {
  visibleContent: string;
  hiddenPrefix: string;
  context: HiddenPromptContext;
}

const HIDDEN_PROMPT_KEY = "neloo_hidden_prompt";

type MessageWithAdditionalKwargs = Message & {
  additional_kwargs?: Record<string, unknown>;
};

export function createHiddenPromptMessage(
  id: string,
  envelope: HiddenPromptEnvelope
): Message {
  return {
    id,
    type: "human",
    content: `${envelope.hiddenPrefix}${envelope.visibleContent}`,
    additional_kwargs: {
      [HIDDEN_PROMPT_KEY]: {
        visibleContent: envelope.visibleContent,
        context: envelope.context,
      },
    },
  } as Message;
}

export function getVisibleHumanContent(message: Message): string | null {
  const additional = (message as MessageWithAdditionalKwargs).additional_kwargs;
  const payload = additional?.[HIDDEN_PROMPT_KEY];

  if (
    payload &&
    typeof payload === "object" &&
    "visibleContent" in payload &&
    typeof (payload as { visibleContent?: unknown }).visibleContent === "string"
  ) {
    return (payload as { visibleContent: string }).visibleContent;
  }

  return typeof message.content === "string" ? message.content : null;
}

export function sanitizeHiddenPromptMessageForPersistence(message: Message): Message {
  if (message.type !== "human") return message;

  const visibleContent = getVisibleHumanContent(message);
  if (visibleContent === null) return message;

  const additional = (message as MessageWithAdditionalKwargs).additional_kwargs;
  const hiddenPayload = additional?.[HIDDEN_PROMPT_KEY];

  if (!hiddenPayload) return message;

  return {
    ...message,
    content: visibleContent,
    additional_kwargs: {
      ...(additional ?? {}),
      [HIDDEN_PROMPT_KEY]: {
        ...(typeof hiddenPayload === "object" && hiddenPayload ? hiddenPayload : {}),
        hiddenPrefix: undefined,
      },
    },
  } as Message;
}

export function sanitizeHiddenPromptMessagesForPersistence(messages: Message[]): Message[] {
  return messages.map(sanitizeHiddenPromptMessageForPersistence);
}
```

Expected: utility can create a model-facing message with hidden instructions, recover visible content, and sanitize messages before persistence.

**Step 2: Compile-check the utility**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
yarn lint src/app/utils/hiddenPromptEnvelope.ts
```

Expected: ESLint passes for the new file. If the repo lint command does not accept file arguments under the current ESLint config, run `yarn lint` and confirm no new errors from this file.

**Step 3: Commit**

```bash
cd /Users/yang/Desktop/agent/neloo
git add frontend/src/app/utils/hiddenPromptEnvelope.ts
git commit -m "feat: add hidden prompt message envelope"
```

---

### Task 2: Change `sendMessage` To Accept Structured Hidden Prompt Context

**Files:**
- Modify: `frontend/src/app/hooks/useChat.ts`
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/providers/ChatProvider.tsx` only if exported types require it

**Step 1: Update the hook contract**

In `frontend/src/app/hooks/useChat.ts`, import the new helpers:

```ts
import {
  createHiddenPromptMessage,
  sanitizeHiddenPromptMessageForPersistence,
  sanitizeHiddenPromptMessagesForPersistence,
  type HiddenPromptEnvelope,
} from "@/app/utils/hiddenPromptEnvelope";
```

Change `sendMessage` from:

```ts
(content: string, hiddenPrefix?: string) => {
```

to:

```ts
(content: string, hiddenPrompt?: HiddenPromptEnvelope) => {
```

Expected: callers can pass hidden prompt metadata instead of a raw string.

**Step 2: Preserve active-agent behavior without visible leakage**

Replace the current `backendContent` block in `sendMessage` with:

```ts
const displayContent = content;
const displayMessage: Message = { id: uuidv4(), type: "human", content: displayContent };

let backendMessage: Message = displayMessage;

if (activeAgent?.systemPrompt) {
  const agentContext = `[System: You are now acting as the agent "${activeAgent.name}". Follow these instructions:\n${activeAgent.systemPrompt}\n---\nUser message:]\n`;
  backendMessage = createHiddenPromptMessage(displayMessage.id, {
    visibleContent: displayContent,
    hiddenPrefix: agentContext,
    context: {
      feature: "agent",
      agentName: activeAgent.name,
    },
  });
} else if (hiddenPrompt) {
  backendMessage = createHiddenPromptMessage(displayMessage.id, hiddenPrompt);
}
```

Expected: the model still receives the hidden prefix, but the message carries a visible-content envelope.

**Step 3: Sanitize every frontend persistence call**

In `persistMessage`, sanitize the message before sending it to `/api/threads/{thread_id}/messages`:

```ts
const messageToPersist = sanitizeHiddenPromptMessageForPersistence(message);
```

Then pass `messageToPersist` to `saveMessageToDbWithRetry`.

In `persistUnsavedMessages`, sanitize the array before iterating:

```ts
const sanitizedMessages = sanitizeHiddenPromptMessagesForPersistence(messagesToSave);
for (const msg of sanitizedMessages) {
  ...
}
```

Expected: the frontend never writes model-facing hidden prompt text into the chat message database.

**Step 4: Update homepage feature callers**

In `frontend/src/app/page.tsx`, replace raw hidden prefix calls:

```ts
onPromptSubmit(userInput, prefix);
onPromptSubmit(userInput, getPromptOptimizePrompt(...));
onPromptSubmit(userInput, getHumanizePrompt(...));
```

with structured envelopes:

```ts
onPromptSubmit(userInput, {
  visibleContent: userInput,
  hiddenPrefix: prefix,
  context: { feature: "fortune", templateId: selectedTemplate?.id ?? 1 },
});
```

```ts
onPromptSubmit(userInput, {
  visibleContent: userInput,
  hiddenPrefix: getPromptOptimizePrompt(selectedTemplate?.id ?? null, selectedTemplate?.promptInstruction),
  context: {
    feature: "prompt-optimize",
    templateId: selectedTemplate?.id ?? undefined,
  },
});
```

```ts
onPromptSubmit(userInput, {
  visibleContent: userInput,
  hiddenPrefix: getHumanizePrompt(selectedTemplate?.id ?? null, selectedTemplate?.promptInstruction),
  context: {
    feature: "deai",
    templateId: selectedTemplate?.id ?? undefined,
  },
});
```

Expected: all three template-driven chat features pass enough non-secret context for debugging while not persisting hidden prompt text as user content.

**Step 5: Run targeted lint**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
yarn lint src/app/hooks/useChat.ts src/app/page.tsx src/app/utils/hiddenPromptEnvelope.ts
```

Expected: no new lint errors.

**Step 6: Commit**

```bash
cd /Users/yang/Desktop/agent/neloo
git add frontend/src/app/hooks/useChat.ts frontend/src/app/page.tsx frontend/src/app/utils/hiddenPromptEnvelope.ts frontend/src/providers/ChatProvider.tsx
git commit -m "fix: separate hidden prompt input from visible chat content"
```

---

### Task 3: Defensively Sanitize Backend Human Message Persistence

**Files:**
- Modify: `backend/src/agent/message_persistence.py`
- Modify: `backend/src/agent/persistence_middleware.py`
- Modify: `backend/src/api/webapp.py`

**Step 1: Add a Python sanitizer for persisted message data**

In `backend/src/agent/message_persistence.py`, add:

```python
HIDDEN_PROMPT_KEY = "neloo_hidden_prompt"

LEGACY_HIDDEN_PREFIX_MARKERS = (
    "You are a senior prompt engineer.",
    "Act like a professional content writer",
    "Analysis direction:",
    "[System: You are now acting as the agent",
)


def strip_legacy_hidden_prompt_prefix(content: str) -> str:
    """
    Best-effort cleanup for messages saved before the hidden prompt envelope
    existed. This handles known Neloo-generated prefixes only.
    """
    if not isinstance(content, str):
        return content

    stripped = content.lstrip()
    if not stripped.startswith(LEGACY_HIDDEN_PREFIX_MARKERS):
        return content

    markers = (
        "\nUser information:\n",
        "\nRewrite the user's text. Return only the rewritten text.",
        "\n- Do not answer the user's task. Only return the improved prompt.",
        "\n---\nUser message:]\n",
    )

    for marker in markers:
        marker_index = stripped.find(marker)
        if marker_index >= 0:
            return stripped[marker_index + len(marker):].lstrip()

    return content


def sanitize_hidden_prompt_message_data(message_data: dict) -> dict:
    """
    Persist only user-visible content for human messages that carry a Neloo
    hidden prompt envelope. Also clean legacy messages that were saved before
    the envelope existed. Keep non-secret context metadata for diagnostics.
    """
    if not isinstance(message_data, dict):
        return message_data

    if message_data.get("type") not in {"human", "user"}:
        return message_data

    content = message_data.get("content")
    additional_kwargs = message_data.get("additional_kwargs")
    if not isinstance(additional_kwargs, dict):
        if isinstance(content, str):
            sanitized_content = strip_legacy_hidden_prompt_prefix(content)
            if sanitized_content != content:
                sanitized = dict(message_data)
                sanitized["content"] = sanitized_content
                return sanitized
        return message_data

    envelope = additional_kwargs.get(HIDDEN_PROMPT_KEY)
    if not isinstance(envelope, dict):
        if isinstance(content, str):
            sanitized_content = strip_legacy_hidden_prompt_prefix(content)
            if sanitized_content != content:
                sanitized = dict(message_data)
                sanitized["content"] = sanitized_content
                return sanitized
        return message_data

    visible_content = envelope.get("visibleContent")
    if not isinstance(visible_content, str):
        return message_data

    sanitized = dict(message_data)
    sanitized["content"] = visible_content

    sanitized_additional = dict(additional_kwargs)
    sanitized_envelope = dict(envelope)
    sanitized_envelope.pop("hiddenPrefix", None)
    sanitized_additional[HIDDEN_PROMPT_KEY] = sanitized_envelope
    sanitized["additional_kwargs"] = sanitized_additional
    return sanitized
```

Expected: backend has one shared sanitizer for both new hidden prompt envelopes and known legacy hidden-prefix message content.

**Step 2: Use the sanitizer in middleware persistence**

In `backend/src/agent/persistence_middleware.py`, change:

```python
from .message_persistence import (
    serialize_message,
    persist_message_atomic,
)
```

to:

```python
from .message_persistence import (
    serialize_message,
    persist_message_atomic,
    sanitize_hidden_prompt_message_data,
)
```

After `message_data["type"] = "human"`, add:

```python
message_data = sanitize_hidden_prompt_message_data(message_data)
```

Expected: even if the frontend fails to sanitize, automatic backend persistence writes visible content only.

**Step 3: Use the sanitizer in explicit save endpoint**

In `backend/src/api/webapp.py`, import `sanitize_hidden_prompt_message_data` near other persistence imports.

Inside `save_thread_message`, before calling `save_chat_message`, add:

```python
message_data = sanitize_hidden_prompt_message_data(request.message_data)
```

Then pass `message_data=message_data`.

Expected: the explicit frontend save endpoint also cannot persist hidden prompt text.

**Step 4: Use the sanitizer in history fallback**

In `_load_db_messages_for_history`, sanitize `message_data` before `_normalize_message_for_langgraph`:

```python
message_data = sanitize_hidden_prompt_message_data(message_data)
```

Expected: existing rows that contain a hidden prompt envelope with visible content are displayed safely.

**Step 5: Use the sanitizer in share API responses**

In `backend/src/api/webapp.py`, locate the share endpoint that calls:

```python
thread_state = await client.threads.get_state(share["thread_id"])
messages = thread_state.get("values", {}).get("messages", [])
```

When serializing each message, sanitize human messages before appending them:

```python
if hasattr(msg, "dict"):
    message_data = msg.dict()
elif isinstance(msg, dict):
    message_data = msg
else:
    message_data = {"type": "unknown", "content": str(msg)}

serialized_messages.append(sanitize_hidden_prompt_message_data(message_data))
```

Expected: shared conversation links cannot expose hidden prompt text even if LangGraph runtime state still contains model-facing message content.

**Step 6: Add focused backend unit coverage if test structure allows**

If there is an existing backend unit-test location for message persistence helpers, add tests for:

```python
def test_sanitize_hidden_prompt_envelope_uses_visible_content():
    message = {
        "type": "human",
        "content": "You are a senior prompt engineer.\n\nsecret\n\nhello",
        "additional_kwargs": {
            "neloo_hidden_prompt": {
                "visibleContent": "hello",
                "context": {"feature": "prompt-optimize", "templateId": 1},
            }
        },
    }
    assert sanitize_hidden_prompt_message_data(message)["content"] == "hello"


def test_sanitize_legacy_prompt_optimize_prefix_best_effort():
    message = {
        "type": "human",
        "content": "You are a senior prompt engineer.\n\n- Do not answer the user's task. Only return the improved prompt.hello",
    }
    assert sanitize_hidden_prompt_message_data(message)["content"] == "hello"
```

If adding tests is not practical because there is no nearby unit-test harness, document that choice in the final verification notes and rely on the browser/DB regression checklist in Task 6.

**Step 7: Run backend syntax check**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/backend
python -m compileall src/agent/message_persistence.py src/agent/persistence_middleware.py src/api/webapp.py
```

Expected: compilation succeeds.

**Step 8: Commit**

```bash
cd /Users/yang/Desktop/agent/neloo
git add backend/src/agent/message_persistence.py backend/src/agent/persistence_middleware.py backend/src/api/webapp.py
git commit -m "fix: sanitize hidden prompt messages before persistence"
```

---

### Task 4: Ensure Visible Rendering And Copy Use Sanitized Content

**Files:**
- Modify: `frontend/src/app/components/ChatMessage.tsx`
- Modify: `frontend/src/app/utils/utils.ts`
- Modify: `frontend/src/app/hooks/useChat.ts`

**Step 1: Use visible content in chat bubbles**

In `frontend/src/app/components/ChatMessage.tsx`, import:

```ts
import { getVisibleHumanContent } from "@/app/utils/hiddenPromptEnvelope";
```

Replace the user-message branch:

```ts
return stripUploadedFilesAnnotation(rawMessageContent);
```

with:

```ts
const visibleContent = getVisibleHumanContent(message) ?? rawMessageContent;
return stripUploadedFilesAnnotation(visibleContent);
```

Expected: any runtime state message with hidden envelope renders only the original user text.

**Step 2: Use visible content in LLM conversation formatting helpers**

In `frontend/src/app/utils/utils.ts`, locate `formatMessageForLLM`. For human messages, call `getVisibleHumanContent(message)` before falling back to raw content.

Expected: copy/share/suggested-question formatting helpers do not accidentally include hidden prompt text.

**Step 3: Rehydrate hidden prompts for regenerate only when safe**

In `frontend/src/app/hooks/useChat.ts`, update regenerate paths so visible UI remains sanitized:

- `editMessageAndRerun` must submit the edited user text as visible content only. Do not carry a previous hidden prefix into the edited message unless the user is still explicitly in that same feature mode and the hidden prefix can be rebuilt from current non-secret UI state.
- `regenerateLastResponse` must sanitize `truncatedMessages` before using them as optimistic values.
- `regenerateLastResponse` may rebuild a model-facing hidden prefix only in memory for the final human message, using `additional_kwargs.neloo_hidden_prompt.context`. It must never persist the rebuilt hidden prefix.
- `forkAndRegenerate` relies on the backend fork API copying DB messages, so backend DB rows must already be sanitized by Task 3. After navigation to the new thread, the loaded messages must not contain hidden prefixes.
- If the context is missing or stale, prefer a safe visible-content regenerate over preserving the exact old template behavior. Security and non-leakage win over template continuity.

Implementation rule: do not persist rebuilt model-facing content. If a regenerate path needs hidden model input, build it only in memory immediately before `stream.submit`, and pair it with sanitized `optimisticValues`.

Expected: regenerated messages do not show hidden prompt text before or after reload.

**Step 4: Run targeted lint**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
yarn lint src/app/components/ChatMessage.tsx src/app/utils/utils.ts src/app/hooks/useChat.ts src/app/utils/hiddenPromptEnvelope.ts
```

Expected: no new lint errors.

**Step 5: Commit**

```bash
cd /Users/yang/Desktop/agent/neloo
git add frontend/src/app/components/ChatMessage.tsx frontend/src/app/utils/utils.ts frontend/src/app/hooks/useChat.ts
git commit -m "fix: render hidden prompt messages with visible content"
```

---

### Task 5: Add A Focused Regression Verification Script

**Files:**
- Create: `docs/plans/hidden-template-prefix-regression-check.md`

**Step 1: Create the regression checklist**

Create `docs/plans/hidden-template-prefix-regression-check.md`:

```markdown
# Hidden Template Prefix Regression Check

## Manual Browser Checks

1. Start frontend and backend.
2. Select `Prompt Optimize`.
3. Select the `Image Generation` template.
4. Enter `make a landing page hero prompt` and submit.
5. Confirm the visible user bubble shows only `make a landing page hero prompt`.
6. Refresh the page with the same `threadId`.
7. Confirm the visible user bubble still shows only `make a landing page hero prompt`.
8. Open browser devtools network response for history state.
9. Confirm `content` for the human message does not include `You are a senior prompt engineer`.
10. Repeat for `Humanize` and confirm no `Act like a professional content writer` text appears in visible history.
11. Repeat for `Fortune Telling` and confirm no `Analysis direction:` prefix appears in visible history.
12. Use regenerate on the last assistant response.
13. Confirm no hidden prompt text appears before or after regenerate.
14. Use fork/regenerate from a previous assistant message.
15. Confirm the new thread does not show hidden prompt text.
16. Create a share link for an assistant response from a template-driven conversation.
17. Open the share link in a fresh browser context.
18. Confirm the shared page does not show any hidden prompt text.
19. If there is an existing old thread created before this fix, reload it and confirm known legacy prefixes are stripped from visible history.

## Backend DB Spot Check

If Supabase is configured, inspect the newest `chat_messages` row for the tested thread:

- `message_data.content` must be the user's original text only.
- `message_data.additional_kwargs.neloo_hidden_prompt.context.feature` may exist.
- No stored field should contain the full hidden prompt prefix.

## Forbidden Visible Strings

- `You are a senior prompt engineer.`
- `Act like a professional content writer`
- `Analysis direction:`
- `[System: You are now acting as the agent`

## Backend API Spot Checks

1. Call the history endpoint for the tested `threadId`.
2. Confirm returned human `content` fields contain only visible user text.
3. Call the share endpoint for a shared conversation.
4. Confirm returned shared human `content` fields contain only visible user text.
5. If any `additional_kwargs.neloo_hidden_prompt` exists, confirm it contains only non-secret `context` and `visibleContent`, not full hidden prompt text.
```

Expected: there is a repeatable acceptance checklist for the exact bug class.

**Step 2: Commit**

```bash
cd /Users/yang/Desktop/agent/neloo
git add docs/plans/hidden-template-prefix-regression-check.md
git commit -m "test: document hidden prompt regression checks"
```

---

### Task 6: Run Full Verification Before Completion

**Files:**
- Verify only: frontend and backend

**Step 1: Run frontend checks**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/frontend
yarn i18n:audit
yarn build
```

Expected: both commands pass. Existing unrelated warnings are acceptable only if they already existed before this fix and are documented.

**Step 2: Run backend checks**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo/backend
python -m compileall src
```

Expected: backend compiles.

**Step 3: Run the browser regression checklist**

Run frontend/backend locally, then complete every item in:

```bash
/Users/yang/Desktop/agent/neloo/docs/plans/hidden-template-prefix-regression-check.md
```

Expected: no hidden prompt prefix appears in visible bubbles, reload history, regenerate, fork/regenerate, or persisted `message_data.content`.

**Step 4: Search for obvious leaked hidden prompt strings in committed docs/code**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
rg -n "You are a senior prompt engineer\\.|Act like a professional content writer|Analysis direction:|\\[System: You are now acting as the agent" frontend/src backend/src docs/plans
```

Expected: matches may exist only in source prompt definitions or this regression checklist. They must not appear in saved fixture data, public history snapshots, or generated artifacts.

**Step 5: Commit final verification notes if needed**

If verification notes are added:

```bash
git add docs/plans/hidden-template-prefix-regression-check.md
git commit -m "test: record hidden prompt regression results"
```

Expected: no uncommitted verification artifacts remain.

---

### Task 7: Push The Repair

**Files:**
- Verify only: git state

**Step 1: Confirm clean status**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git status --short
git log --oneline -8
```

Expected: worktree is clean and recent commits match the tasks above.

**Step 2: Push**

Run:

```bash
cd /Users/yang/Desktop/agent/neloo
git push origin main
```

Expected: push succeeds.

**Step 3: User-facing acceptance statement**

Report the final user-visible behavior:

- Selecting Prompt Optimize / Humanize / Fortune templates still changes the generated result.
- The input box and chat bubble show only what the user typed.
- Reloaded history shows only what the user typed.
- Regenerate and fork do not expose hidden template instructions.
- Share/copy paths do not expose hidden template instructions.
