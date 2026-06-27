# Model Selector Configuration Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Neloo's open-source setup checker and documentation match the current canonical public model selector behavior.

**Architecture:** Keep the backend model registry and public model IDs unchanged. Mirror the backend provider requirements in the configurator's Node.js environment checker, then clarify the docs around complete model provider configuration, hidden legacy IDs, and graph build flags.

**Tech Stack:** Node.js ES modules, `node:test`, Python/LangGraph backend configuration, Markdown documentation.

---

## Current State

The current public model selector is driven by `backend/src/agent/graph.py` and exposes only these canonical provider IDs from `backend/src/model_ids.py`:

```text
deepseek, qwen, minimax, anthropic, openai, gemini, zhipu, openrouter, custom-openai, custom-anthropic
```

The backend availability logic does more than checking for an API key:

- `qwen`, `minimax`, `gemini`, `zhipu`, `openrouter`, `custom-openai`, and `custom-anthropic` require a base URL variable.
- `custom-openai` and `custom-anthropic` also require a model name variable.
- `anthropic`, `openai`, and `gemini` support multiple credential routes.
- Legacy IDs are hidden from the selector but remain registered or aliased for compatibility.

The current configurator checker only checks whether at least one chat model key exists. That can incorrectly say the environment is usable when `/api/models` will mark the configured provider unavailable.

## Non-Goals

- Do not re-add duplicate model entries to the frontend selector.
- Do not change `PUBLIC_MODEL_IDS`.
- Do not rewrite `backend/src/agent/graph.py` unless verification proves the docs-only legacy compatibility fix is insufficient.
- Do not remove hidden legacy graph IDs.
- Do not treat frontend `NEXT_PUBLIC_*` model keys as safe backend model credentials.
- Do not run a broad unrelated frontend lint cleanup.

---

### Task 1: Add Failing Tests for Complete Chat Provider Configs

**Files:**
- Modify: `neloo-configurator/scripts/check-env.test.mjs`

**Step 1: Add small test helpers**

Add these helpers near the imports, before the first test:

```js
function reportFor(backendValues, frontendValues = {}) {
  return analyzeEnvironment({
    backend: {
      exists: true,
      values: {
        SANDBOX_MODE: "local",
        ...backendValues,
      },
    },
    frontend: {
      exists: true,
      values: {
        NEXT_PUBLIC_API_URL: "http://localhost:2024",
        ...frontendValues,
      },
    },
  });
}

function hasCode(report, code) {
  return report.items.some((item) => item.code === code);
}
```

Keep the existing tests working. It is acceptable to refactor existing tests to use the helpers only if that makes the assertions clearer.

**Step 2: Add tests that should fail before implementation**

Add these tests after the existing "reports missing model key" test:

```js
test("analyzeEnvironment rejects Gemini key without required base URL", () => {
  const report = reportFor({ GEMINI_API_KEY: "key" });

  assert.equal(report.ok, false);
  assert.equal(hasCode(report, "missing-complete-chat-model-config"), true);
  assert.match(formatReport(report), /Gemini/);
  assert.match(formatReport(report), /GEMINI_BASE_URL/);
});

test("analyzeEnvironment rejects custom OpenAI key without base URL and model", () => {
  const report = reportFor({ CUSTOM_OPENAI_API_KEY: "key" });

  assert.equal(report.ok, false);
  assert.equal(hasCode(report, "missing-complete-chat-model-config"), true);
  assert.match(formatReport(report), /Custom OpenAI-compatible/);
  assert.match(formatReport(report), /CUSTOM_OPENAI_BASE_URL/);
  assert.match(formatReport(report), /CUSTOM_OPENAI_MODEL/);
});

test("analyzeEnvironment accepts complete custom OpenAI config", () => {
  const report = reportFor({
    CUSTOM_OPENAI_API_KEY: "key",
    CUSTOM_OPENAI_BASE_URL: "https://example.test/v1",
    CUSTOM_OPENAI_MODEL: "my-model",
  });

  assert.equal(report.ok, true);
  assert.equal(hasCode(report, "missing-complete-chat-model-config"), false);
});

test("analyzeEnvironment accepts Tu-Zi gateway as a complete OpenAI-compatible provider", () => {
  const report = reportFor({
    TUZI_API_KEY: "key",
    TUZI_BASE_URL: "https://api.tu-zi.com/v1",
  });

  assert.equal(report.ok, true);
  assert.equal(hasCode(report, "missing-complete-chat-model-config"), false);
});

test("analyzeEnvironment warns about incomplete extra provider when one provider is usable", () => {
  const report = reportFor({
    DEEPSEEK_API_KEY: "key",
    GEMINI_API_KEY: "gemini-key",
  });

  assert.equal(report.ok, true);
  assert.equal(hasCode(report, "incomplete-chat-model-config"), true);
  assert.match(formatReport(report), /GEMINI_BASE_URL/);
});
```

**Step 3: Run tests and verify they fail**

Run:

```bash
node --test neloo-configurator/scripts/check-env.test.mjs
```

Expected before implementation:

```text
not ok ... rejects Gemini key without required base URL
not ok ... rejects custom OpenAI key without base URL and model
not ok ... warns about incomplete extra provider when one provider is usable
```

The exact line numbers can differ. The important point is that at least the new provider-completeness tests fail.

---

### Task 2: Implement Provider-Level Chat Model Validation

**Files:**
- Modify: `neloo-configurator/scripts/check-env.mjs:6-120`

**Step 1: Add a provider config table**

Add this table after `CHAT_MODEL_KEYS`:

```js
export const CHAT_MODEL_CONFIGS = [
  {
    id: "deepseek",
    label: "DeepSeek",
    credentials: [{ key: "DEEPSEEK_API_KEY" }],
  },
  {
    id: "qwen",
    label: "Qwen",
    credentials: [{ key: "QWEN_API_KEY", required: ["QWEN_BASE_URL"] }],
  },
  {
    id: "minimax",
    label: "MiniMax",
    credentials: [{ key: "MINIMAX_API_KEY", required: ["MINIMAX_ANTHROPIC_BASE_URL"] }],
  },
  {
    id: "anthropic",
    label: "Claude",
    credentials: [
      { key: "ANTHROPIC_API_KEY" },
      { key: "NEWAPI_API_KEY", required: ["NEWAPI_ANTHROPIC_BASE_URL"] },
      { key: "TUZI_ANTHROPIC_API_KEY", required: ["TUZI_ANTHROPIC_BASE_URL"] },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    credentials: [
      { key: "OPENAI_API_KEY" },
      { key: "TUZI_API_KEY", required: ["TUZI_BASE_URL"] },
    ],
  },
  {
    id: "gemini",
    label: "Gemini",
    credentials: [
      { key: "GEMINI_API_KEY", required: ["GEMINI_BASE_URL"] },
      { key: "TUZI_API_KEY", required: ["TUZI_BASE_URL"] },
    ],
  },
  {
    id: "zhipu",
    label: "GLM",
    credentials: [{ key: "ZHIPU_API_KEY", required: ["ZHIPU_BASE_URL"] }],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    credentials: [{ key: "OPENROUTER_API_KEY", required: ["OPENROUTER_BASE_URL"] }],
  },
  {
    id: "custom-openai",
    label: "Custom OpenAI-compatible",
    credentials: [
      {
        key: "CUSTOM_OPENAI_API_KEY",
        required: ["CUSTOM_OPENAI_BASE_URL", "CUSTOM_OPENAI_MODEL"],
      },
    ],
  },
  {
    id: "custom-anthropic",
    label: "Custom Anthropic-compatible",
    credentials: [
      {
        key: "CUSTOM_ANTHROPIC_API_KEY",
        required: ["CUSTOM_ANTHROPIC_BASE_URL", "CUSTOM_ANTHROPIC_MODEL"],
      },
    ],
  },
];
```

This table should intentionally match the public selector availability rules in `backend/src/agent/graph.py:1072-1177`. Do not add `NEWAPI_BASE_URL` as a complete public OpenAI route because the canonical public `openai` entry does not use it.

**Step 2: Add helper functions**

Add these helpers after `hasValue`:

```js
function missingRequired(values, credential) {
  return (credential.required || []).filter((key) => !hasValue(values, key));
}

function describeCredential(credential) {
  const required = credential.required && credential.required.length > 0
    ? ` plus ${credential.required.join(" + ")}`
    : "";
  return `${credential.key}${required}`;
}

export function evaluateChatModelConfigs(values) {
  const complete = [];
  const incomplete = [];

  for (const config of CHAT_MODEL_CONFIGS) {
    let configComplete = false;

    for (const credential of config.credentials) {
      if (!hasValue(values, credential.key)) continue;

      const missing = missingRequired(values, credential);
      if (missing.length === 0) {
        configComplete = true;
        complete.push({
          id: config.id,
          label: config.label,
          credential: credential.key,
        });
      } else {
        incomplete.push({
          id: config.id,
          label: config.label,
          credential: credential.key,
          missing,
          expected: describeCredential(credential),
        });
      }
    }

    if (configComplete) {
      for (let i = incomplete.length - 1; i >= 0; i -= 1) {
        if (incomplete[i].id === config.id) incomplete.splice(i, 1);
      }
    }
  }

  return { complete, incomplete };
}

function formatIncompleteChatModels(incomplete) {
  return incomplete
    .map((item) => `${item.label} (${item.credential}) missing ${item.missing.join(", ")}`)
    .join("; ");
}
```

Keep these helpers deterministic and dependency-free. The checker must stay usable without importing Python backend modules.

**Step 3: Replace the current chat-key-only check**

Replace the block at `neloo-configurator/scripts/check-env.mjs:103-105` with:

```js
  if (backend.exists) {
    const hasAnyChatKey = CHAT_MODEL_KEYS.some((key) => hasValue(backendValues, key));
    const chatModelStatus = evaluateChatModelConfigs(backendValues);

    if (!hasAnyChatKey) {
      add(report, "error", "missing-chat-model-key", `Set at least one backend chat model key: ${CHAT_MODEL_KEYS.join(", ")}.`, "backend/.env");
    } else if (chatModelStatus.complete.length === 0) {
      const details = chatModelStatus.incomplete.length > 0
        ? ` Incomplete provider config: ${formatIncompleteChatModels(chatModelStatus.incomplete)}.`
        : "";
      add(report, "error", "missing-complete-chat-model-config", `Set at least one complete backend chat model provider configuration.${details}`, "backend/.env");
    } else if (chatModelStatus.incomplete.length > 0) {
      add(report, "warning", "incomplete-chat-model-config", `Some configured model providers will not appear as available: ${formatIncompleteChatModels(chatModelStatus.incomplete)}.`, "backend/.env");
    }
  }
```

There is already an `if (backend.exists) { ... }` block below this area. Avoid nesting duplicate `if (backend.exists)` blocks in a confusing way; either keep the new block standalone or merge it cleanly with the existing backend-only checks.

**Step 4: Run focused tests**

Run:

```bash
node --test neloo-configurator/scripts/check-env.test.mjs
```

Expected:

```text
# tests 10
# pass 10
# fail 0
```

The final number may be higher if extra focused tests are added. It must have zero failures.

**Step 5: Commit this task**

Run:

```bash
git add neloo-configurator/scripts/check-env.mjs neloo-configurator/scripts/check-env.test.mjs
git commit -m "fix: validate complete model provider configs"
```

Expected:

```text
[main <sha>] fix: validate complete model provider configs
```

Do not push yet unless the user explicitly asks for execution and push.

---

### Task 3: Clarify Chat Provider Docs and Legacy Model Semantics

**Files:**
- Modify: `docs/configuration.md:101-122`
- Modify: `neloo-configurator/references/configuration-map.md:60-75`
- Modify: `README.md:143-146`

**Step 1: Clarify complete provider requirements in `docs/configuration.md`**

Update the paragraph under `## Chat Model Configuration` to state:

```markdown
The selector marks a provider available only when the backend can build that provider: the API key must be present, and providers with `requires_base_url` or `requires_model_env` in `backend/src/agent/graph.py` also need the matching URL or model variable. Values shown in `.env.example` are examples; in Railway or another host you must set the same variables explicitly.
```

**Step 2: Tighten the table notes**

Adjust rows with required URLs so they do not imply the backend has a hard-coded URL fallback:

- Qwen: say `QWEN_BASE_URL` must be set, commonly `https://dashscope.aliyuncs.com/compatible-mode/v1`.
- OpenRouter: say `OPENROUTER_BASE_URL` must be set, commonly `https://openrouter.ai/api/v1`.
- Gemini: say `GEMINI_BASE_URL` is required unless routing through `TUZI_API_KEY` + `TUZI_BASE_URL`.
- Custom provider rows: explicitly say both base URL and model are required.
- Claude/OpenAI native rows: keep native base URL optional.

**Step 3: Replace the legacy ID paragraph**

Replace the current paragraph around `docs/configuration.md:120` with:

```markdown
Old graph IDs such as `deepseek-chat`, `qwen3-max`, `gpt-5-thinking`, and `claude-opus-right` are hidden from the selector but kept so existing LangGraph graph IDs and older stored thread values do not crash. The thread API normalizes old stored `model_id` values to the canonical public ID for display and future updates. If you need the old exact model choice, set the canonical provider's model variable, for example `DEEPSEEK_MODEL=deepseek-reasoner`, `QWEN_MODEL=qwen3-max`, or `OPENAI_MODEL=gpt-5-thinking`.
```

Also add:

```markdown
`NEWAPI_BASE_URL` remains a legacy compatibility variable for old direct graph IDs. It does not make the canonical `OpenAI` selector entry available by itself; use `OPENAI_API_KEY`, `TUZI_API_KEY` + `TUZI_BASE_URL`, or `CUSTOM_OPENAI_*` for the public selector.
```

**Step 4: Mirror the same guidance in `configuration-map.md`**

Update `neloo-configurator/references/configuration-map.md:60-75`:

- Change "marks each model available if the corresponding key is present" to "marks each model available only when the provider's key, required URL, and required model variable are present."
- Add a short "Legacy behavior" paragraph matching the `docs/configuration.md` wording.
- Add a note that `NEWAPI_BASE_URL` is not counted as a complete canonical public provider route.

**Step 5: Update the README summary table**

In `README.md:145-146`, add one concise sentence below the model provider rows:

```markdown
For providers with a required base URL or custom model variable, the API key alone is not enough; see `docs/configuration.md` for the complete provider combinations.
```

Do not expand the README into a second full configuration guide. Keep detailed setup in `docs/configuration.md`.

**Step 6: Verify docs contain the new guidance**

Run:

```bash
rg -n "complete backend chat model|NEWAPI_BASE_URL|old graph IDs|required base URL|API key alone" docs/configuration.md neloo-configurator/references/configuration-map.md README.md
```

Expected:

```text
docs/configuration.md:...
neloo-configurator/references/configuration-map.md:...
README.md:...
```

The output must show each new concept in the intended file.

**Step 7: Commit this task**

Run:

```bash
git add docs/configuration.md neloo-configurator/references/configuration-map.md README.md
git commit -m "docs: clarify model provider setup"
```

Expected:

```text
[main <sha>] docs: clarify model provider setup
```

---

### Task 4: Clarify Graph Build Flag Behavior

**Files:**
- Modify: `docs/configuration.md:76-87`
- Modify: `backend/.env.example:19-24`
- Modify: `neloo-configurator/references/configuration-map.md:38-46`

**Step 1: Clarify `docs/configuration.md` server variable rows**

Replace the `NELOO_BUILD_ALL_MODEL_GRAPHS` and `NELOO_BUILD_VARIANT_GRAPHS` descriptions with:

```markdown
| `NELOO_BUILD_ALL_MODEL_GRAPHS` | Optional | When `false`, Neloo still registers public model graph exports and builds configured public provider graphs as needed during startup. Set `true` only to eagerly build every configured canonical and hidden legacy model graph. |
| `NELOO_BUILD_VARIANT_GRAPHS` | Optional | Set `true` to build real `-web-dev` and `-fortune` graph variants. When `false`, variant graph IDs fall back to the base graph. |
```

**Step 2: Replace the graph flag paragraph near the chat model section**

Replace the current paragraph around `docs/configuration.md:122` with:

```markdown
You normally do not need `NELOO_BUILD_ALL_MODEL_GRAPHS=true` for the selector. Public configured provider graph exports are registered by default. Use `NELOO_BUILD_ALL_MODEL_GRAPHS=true` only when you intentionally want all configured canonical and hidden legacy graph IDs built eagerly at import time.
```

**Step 3: Update `.env.example` comments**

Add comments above `NELOO_BUILD_ALL_MODEL_GRAPHS=false`:

```bash
# false keeps startup lighter while still exposing public selector graph IDs.
# true eagerly builds every configured canonical and hidden legacy model graph.
```

Add comments above `NELOO_BUILD_VARIANT_GRAPHS=false`:

```bash
# true builds real -web-dev and -fortune variants; false aliases variants to base graphs.
```

**Step 4: Update configurator reference map**

In `neloo-configurator/references/configuration-map.md:45-46`, mirror the same concise descriptions.

**Step 5: Verify flag docs**

Run:

```bash
rg -n "hidden legacy|selector graph IDs|variant graph IDs|built eagerly|aliases variants" docs/configuration.md backend/.env.example neloo-configurator/references/configuration-map.md
```

Expected:

```text
docs/configuration.md:...
backend/.env.example:...
neloo-configurator/references/configuration-map.md:...
```

**Step 6: Commit this task**

Run:

```bash
git add docs/configuration.md backend/.env.example neloo-configurator/references/configuration-map.md
git commit -m "docs: clarify model graph build flags"
```

Expected:

```text
[main <sha>] docs: clarify model graph build flags
```

---

### Task 5: Final Verification

**Files:**
- No planned file changes.

**Step 1: Run configurator tests**

Run:

```bash
node --test neloo-configurator/scripts/*.test.mjs
```

Expected:

```text
# fail 0
```

The exact pass count depends on how many tests were added.

**Step 2: Run Python syntax checks**

Run:

```bash
python3 -m py_compile backend/src/model_ids.py backend/src/agent/graph.py backend/src/api/webapp.py backend/src/storage/supabase_db.py
```

Expected: no output and exit code `0`.

**Step 3: Run model ID tests**

Run:

```bash
uv run --with pytest python -m pytest backend/tests/test_model_ids.py
```

Expected:

```text
4 passed
```

The existing warning about unknown pytest `asyncio_mode` is acceptable unless it changes into a failure.

**Step 4: Validate LangGraph config JSON**

Run:

```bash
node -e 'const fs=require("fs"); JSON.parse(fs.readFileSync("backend/langgraph.json","utf8")); console.log("backend/langgraph.json ok")'
```

Expected:

```text
backend/langgraph.json ok
```

**Step 5: Run targeted frontend model lint**

Run:

```bash
cd frontend && npm exec eslint src/lib/models.ts
```

Expected: no output and exit code `0`.

Do not use full `npm --prefix frontend run lint` as the acceptance gate for this task because the repository currently has unrelated pre-existing frontend lint failures.

**Step 6: Check whitespace and accidental conflict markers**

Run:

```bash
git diff --check
rg -n "<<<<<<<|=======|>>>>>>>" neloo-configurator/scripts docs README.md backend/.env.example
```

Expected:

```text
```

Both commands should produce no output.

---

### Task 6: Review and Final Commit State

**Files:**
- No planned file changes.

**Step 1: Review the diff**

Run:

```bash
git status --short
git diff --stat HEAD~3..HEAD
git diff HEAD~3..HEAD -- neloo-configurator/scripts/check-env.mjs neloo-configurator/scripts/check-env.test.mjs docs/configuration.md neloo-configurator/references/configuration-map.md README.md backend/.env.example
```

Expected:

- Only the checker, checker tests, and docs/config examples changed.
- No changes to `backend/src/agent/graph.py`, `backend/src/model_ids.py`, `backend/src/api/webapp.py`, or `frontend/src/lib/models.ts`.
- No secrets or private values were added.

**Step 2: Confirm acceptance criteria**

Acceptance criteria:

- `check-env.mjs` reports an error when only an incomplete provider config exists, for example `GEMINI_API_KEY` without `GEMINI_BASE_URL`.
- `check-env.mjs` remains permissive when at least one provider is complete and only warns about extra incomplete providers.
- Existing minimal DeepSeek setup still passes with warnings only.
- Docs tell users where model keys, model URLs, and model names are configured.
- Docs explicitly explain hidden legacy IDs and canonical UI normalization.
- Docs explain that `NELOO_BUILD_ALL_MODEL_GRAPHS=true` is not required just to use the public selector.

**Step 3: Stop before pushing**

Do not push automatically. Report the verification results and ask whether to push.

If the user explicitly asks to push after successful verification:

```bash
git push origin main
```

Expected:

```text
To https://github.com/Imd11/neloo
   <old>..<new>  main -> main
```
