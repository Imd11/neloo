# Feature Buttons Functionality Audit

Date: 2026-07-02
Frontend URL: http://localhost:3001/
Backend URL: http://127.0.0.1:2024/

## Summary

| Button | Verdict | Frontend Path | Backend/API Path | Main Risk |
|---|---|---|---|---|
| AI Image | partial | `featureTemplates.ts` -> `FeatureButtons.tsx` -> `page.tsx` -> `ImageExperience` -> `ImagePageContent` | Next route `POST /api/generate-image` -> Tu-Zi-compatible image API | Dedicated UI exists, but current local server is missing `NANOBANANA_IMAGE_API_KEY`, so generation returns a 500 configuration error. |
| Slides | partial | `featureTemplates.ts` -> `FeatureButtons.tsx` -> `page.tsx` -> `SlidesExperience` -> `OutlineEditor` | Browser-side DeepSeek and Tu-Zi calls; Supabase persistence | Entry and editor exist, but current local slide-generation keys are missing and slide persistence references a `slide_presentations` table with no migration found in this repo. |
| Prompt Optimize | pseudo-entry | `featureTemplates.ts` -> `FeatureButtons.tsx` -> `PromptInput` -> generic `sendMessage` | Normal LangGraph chat graph | The button only adds a feature tag and placeholder. It does not inject an optimization prompt or call a dedicated optimizer route. |
| Fortune Telling | partial | `featureTemplates.ts` -> `FeatureButtons.tsx` -> `TemplatePromptInput` -> `sendMessage(hiddenPrefix)` | LangGraph `{model}-fortune` graph using `FORTUNE_PROMPT` | Dedicated mode exists, but the structured form can submit placeholder text with no required-field validation. |
| Humanize | pseudo-entry | `featureTemplates.ts` -> `FeatureButtons.tsx` -> `PromptInput` -> generic `sendMessage` | Normal LangGraph chat graph | The button only adds a feature tag and placeholder. It does not inject a humanization prompt or call a dedicated humanizer route. |
| AI Translate | fail | `featureTemplates.ts` -> `FeatureButtons.tsx` -> `page.tsx` -> `TranslatePanel` | Backend `POST /api/translate` -> DeepSeek chat completions | Dedicated UI exists, but current local `POST /api/translate` timed out with no response; source language is not sent; much of the panel is hard-coded Chinese. |

## Runtime Baseline

- Frontend process: `node` is listening on `*:3001`.
- Backend process: Python/LangGraph is listening on `127.0.0.1:2024`.
- Homepage response: `curl -I http://localhost:3001/` returned `HTTP/1.1 200 OK`.
- Browser state: the homepage rendered all six audited buttons: `AI Image`, `Slides`, `Prompt Optimize`, `Fortune Telling`, `Humanize`, and `AI Translate`.
- LangGraph runtime: `POST /assistants/search` returned assistants including configured default/web-dev variants.

## Detailed Findings

### AI Image

- Static chain: `features` contains `id: "image"`, `FeatureButtons` renders it, `handleSelectFeature` sets `activeFeatureId` to `image`, and `page.tsx` renders `ImageExperience`.
- Runtime behavior: the user gets a dedicated image workspace with prompt input, image model selector, aspect ratio, resolution controls, chat panel, and canvas.
- Network/API evidence: `POST http://localhost:3001/api/generate-image` with a test prompt returned `500 {"error":"Server configuration error"}`.
- Required config: `NANOBANANA_IMAGE_API_KEY`; optional `NEXT_PUBLIC_IMAGE_API_URL`.
- Current local status: `NANOBANANA_IMAGE_API_KEY` was not found in the checked local env files.
- User-visible result: the user can enter the image workspace, but generation fails unless the server-side image key is configured. The error is visible, but it is generic and does not tell the user exactly which key is missing.
- Verdict: partial.
- Fix recommendation: keep the dedicated UI, but surface a clear missing-key message in the UI and document that `NANOBANANA_IMAGE_API_KEY` is required for image generation.

### Slides

- Static chain: `features` contains `id: "slides"`, `FeatureButtons` renders it, `handlePromptSubmit` calls `onEnterSlidesEditMode`, and `page.tsx` renders `SlidesExperience`.
- Runtime behavior: the user selects Slides, enters a topic, optionally chooses a preset, and is taken into the slide outline editor.
- Network/API evidence: `SlidesExperience` calls `generateOutlineStream`, which uses browser-exposed `NEXT_PUBLIC_DEEPSEEK_API_KEY`; slide image generation uses `NEXT_PUBLIC_TUZI_IMAGE_API_KEY` or `NEXT_PUBLIC_TUZI_API_KEY`.
- Required config: `NEXT_PUBLIC_DEEPSEEK_API_KEY`, `NEXT_PUBLIC_TUZI_IMAGE_API_KEY` or `NEXT_PUBLIC_TUZI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and a Supabase table named `slide_presentations` for persistence.
- Current local status: slide-generation keys were not found in checked local env files; Supabase public URL and anon key are configured locally; no migration defining `slide_presentations` was found.
- User-visible result: the entry flow is understandable, but generation will fail locally at outline creation with a missing public DeepSeek key unless configured. Persistence can also fail if the database table is absent.
- Verdict: partial.
- Fix recommendation: move provider calls behind server-side routes or clearly mark the current browser-side keys as local-only; add or document the `slide_presentations` migration; show missing-key errors before the user starts generation.

### Prompt Optimize

- Static chain: `features` contains `id: "prompt-optimize"`, `FeatureButtons` renders it, `PromptInput` shows the localized placeholder and feature chip, and `handlePromptSubmit` calls generic `sendMessage`.
- Runtime behavior: selecting the button changes the placeholder and hides the feature button row. Submitting sends the raw user text to the normal chat graph.
- Network/API evidence: no dedicated frontend service, backend route, hidden prefix, or LangGraph mode was found for prompt optimization.
- Required config: any configured chat model supported by the normal model selector.
- Current local status: normal chat models are available through the configured backend.
- User-visible result: the feature looks specialized, but the only functional difference is a tag and placeholder. The model may optimize the prompt only if the user explicitly asks for that in the message.
- Verdict: pseudo-entry.
- Fix recommendation: either add a hidden optimization instruction/prompt template for this mode, or relabel it as a prompt starter instead of a separate feature.

### Fortune Telling

- Static chain: `features` contains `id: "fortune"`, `TemplatePromptInput` renders a structured birth-information form, `handlePromptSubmit` prepends `getFortuneTemplatePrefix`, and `useChat` selects `{baseModel}-fortune`.
- Runtime behavior: selecting the button changes the input to a structured form and sends only the user-visible text to the UI while sending hidden fortune instructions to the backend.
- Network/API evidence: backend graph creation builds `{model_id}-fortune` variants and `build_graph(mode="fortune")` replaces the system prompt with `FORTUNE_PROMPT`.
- Required config: any configured chat model that successfully builds a fortune graph, most directly `DEEPSEEK_API_KEY` for the current default model.
- Current local status: `DEEPSEEK_API_KEY` is configured locally in ignored env files.
- User-visible result: this is a real specialized mode. The main UX gap is that empty placeholders can be submitted as if they were real birth data.
- Verdict: partial.
- Fix recommendation: add required-field validation or a review state before submit; keep using the hidden prefix and fortune graph because that part is wired correctly.

### Humanize

- Static chain: `features` contains `id: "deai"`, `FeatureButtons` renders it as `Humanize`, `PromptInput` shows the localized placeholder and feature chip, and `handlePromptSubmit` calls generic `sendMessage`.
- Runtime behavior: selecting the button changes the placeholder and hides the feature button row. Submitting sends the raw user text to the normal chat graph.
- Network/API evidence: no dedicated frontend service, backend route, hidden prefix, or LangGraph mode was found for humanization.
- Required config: any configured chat model supported by the normal model selector.
- Current local status: normal chat models are available through the configured backend.
- User-visible result: the feature looks specialized, but behaves like ordinary chat unless the user explicitly asks the model to humanize the text.
- Verdict: pseudo-entry.
- Fix recommendation: add a hidden humanization instruction/prompt template, or make the button insert an editable humanization prompt so users understand what will happen.

### AI Translate

- Static chain: `features` contains `id: "translate"`, `FeatureButtons` renders it, `handleSelectFeature` sets `activeFeatureId` to `translate`, and `page.tsx` renders `TranslatePanel`.
- Runtime behavior: the user gets a dedicated translation panel with source/target language selectors, style cards, two text areas, swap, translate, and copy controls.
- Network/API evidence: `TranslatePanel` calls `POST /api/translate`; backend `translate_routes.py` uses `DEEPSEEK_API_KEY` and the `deepseek-chat` model. A local direct `POST /api/translate` test timed out after 15 seconds with no response.
- Required config: `DEEPSEEK_API_KEY`; frontend also requires `NEXT_PUBLIC_API_URL` to point at the backend.
- Current local status: `DEEPSEEK_API_KEY` and `NEXT_PUBLIC_API_URL` are configured locally in ignored env files.
- User-visible result: the panel exists, but the local request can hang rather than fail clearly. The source-language selector is misleading because the request body sends only `text`, `target_language`, and `style`; it does not send `sourceLang`. The panel also contains hard-coded Chinese labels and toasts, so English mode is not fully localized.
- Verdict: fail.
- Fix recommendation: add backend request timeout and clear UI error handling; send source language or remove the selector; localize the panel; consider moving this to the same model availability/config status system as the top-left chat models.

## Environment and Config Dependencies

| Feature | Required Variables | Current Local Status | Missing Config UX |
|---|---|---|---|
| AI Image | `NANOBANANA_IMAGE_API_KEY`, optional `NEXT_PUBLIC_IMAGE_API_URL` | server image key not found locally | Next route returns generic 500 JSON; UI toast does not name the missing variable. |
| Slides | `NEXT_PUBLIC_DEEPSEEK_API_KEY`, `NEXT_PUBLIC_TUZI_IMAGE_API_KEY` or `NEXT_PUBLIC_TUZI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public Supabase vars configured; slide provider keys not found locally | outline/image generation fails after entering the editor; missing-key preflight is absent. |
| Prompt Optimize | normal chat model env vars | normal backend model availability exists | no missing-config issue, but the feature is not specialized. |
| Fortune Telling | normal chat model env vars, especially current default model key | current default model key configured locally | no preflight needed, but form validation is missing. |
| Humanize | normal chat model env vars | normal backend model availability exists | no missing-config issue, but the feature is not specialized. |
| AI Translate | `DEEPSEEK_API_KEY`, `NEXT_PUBLIC_API_URL` | both configured locally | local request timed out; UI catches errors but does not expose root cause. |

## Open Risks

- `Prompt Optimize` and `Humanize` are currently pseudo-features: users may expect deterministic specialized behavior, but the app only changes the placeholder and chip.
- Several slide and image flows depend on public browser-side API keys. That is acceptable only for local development or restricted keys, not for a public production deployment.
- Slide persistence uses `slide_presentations`, but no matching Supabase migration was found in the repository scan.
- Translation has UI/logic mismatch: source language is selectable but not sent to the backend, and localization is incomplete.
- Current local env files contain configured provider secrets but are ignored by Git. Do not force-add env files when committing.

## Recommended Fix Plan

1. Add feature-mode preflight status before expensive actions:
   - AI Image: check `NANOBANANA_IMAGE_API_KEY`.
   - Slides: check `NEXT_PUBLIC_DEEPSEEK_API_KEY` and Tu-Zi key, or move calls server-side.
   - Translate: check backend reachability and model key availability.
2. Convert pseudo-features into real feature modes:
   - `prompt-optimize`: prepend a hidden optimization instruction or open an editable prompt template.
   - `deai`: prepend a hidden humanization instruction or open an editable humanization template.
3. Fix translation UX:
   - Send source language or remove the selector.
   - Add timeout handling and localized errors.
   - Localize all labels, placeholders, toasts, and headlines.
4. Fix slides persistence:
   - Add a Supabase migration for `slide_presentations` or change persistence to an existing table.
5. Improve visible errors:
   - Replace generic "Server configuration error" with safe, non-secret messages naming the missing variable.
