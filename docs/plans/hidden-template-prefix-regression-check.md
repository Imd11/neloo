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

### Automated Backend Persistence Check

Run:

```bash
cd backend
python3.13 scripts/check_hidden_prompt_persistence.py --base-url http://127.0.0.1:2024
```

This must pass before marking history/share/fork hidden prompt persistence as verified. If it reports that durable persistence is unavailable, configure a reachable `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and required migrations before marking those flows as passed.

## Execution Results - 2026-07-05 Repair Pass

- Frontend URL: `http://localhost:3000`
- Backend URL: `http://127.0.0.1:2024`
- Supabase durable persistence configured: NO. `POST /api/threads` now returns `503 Service Unavailable` with `Durable thread persistence is unavailable. Check SUPABASE_URL, SUPABASE_SERVICE_KEY, network access, and required Supabase migrations.` The local `SUPABASE_URL` host could not be resolved by DNS in this environment.
- Backend API test env isolation: PASS. `tests/test_hidden_prompt_api_flows.py` now sets deterministic dummy model env defaults before importing the app and does not load a private `.env`; it intentionally does not set dummy Supabase env values.
- Homepage load: PASS. `curl -I http://localhost:3000` returned `HTTP/1.1 200 OK`.
- Homepage forbidden strings: PASS. `curl http://localhost:3000` did not contain `You are a senior prompt engineer.`, `Act like a professional content writer`, `Analysis direction:`, or `[System: You are now acting as the agent`.
- Backend persistence script: SKIP. `python3.13 scripts/check_hidden_prompt_persistence.py --base-url http://127.0.0.1:2024` reported durable thread persistence unavailable and exited with code `2`; this is the expected non-pass state until Supabase is reachable.
- Prompt Optimize submit: PASS for frontend hidden-prompt display logic by existing visible UI regression and frontend sanitizer script. Full durable refresh/history verification is SKIPPED until Supabase is reachable.
- Prompt Optimize refresh/history response: SKIP. Requires durable Supabase thread persistence.
- Humanize submit/history: SKIP for durable history. Requires durable Supabase thread persistence.
- Fortune submit/history: SKIP for durable history. Requires durable Supabase thread persistence and complete birth information for a model request.
- Regenerate: PASS for code-level coverage. `regenerateLastResponse` uses sanitized optimistic UI messages and rebuilds model-facing hidden prompts only in memory for known template features.
- Fork/regenerate: SKIP. Requires durable Supabase thread persistence and saved `chat_messages` rows.
- Share page/API: SKIP. Requires durable Supabase thread persistence and a saved `shared_conversations` row.
- DB spot check: SKIP. Requires reachable Supabase and completed migrations.
- Forbidden visible/API strings: PASS for automated backend route tests and static homepage check. Backend API tests cover save-message and share serialization sanitization with monkeypatched storage/LangGraph state; homepage HTML did not contain forbidden markers.
- Model stream note: The LangGraph realtime `/runs/stream` response still includes the model-facing hidden prompt during generation. This remains an explicit architecture decision item and must not be described as secret from a user inspecting their own network traffic.
- Blockers or skipped checks: Durable refresh/history, fork/regenerate, share page, and DB spot checks are explicitly unavailable in this local environment because Supabase thread persistence is not reachable. They must be rerun after setting a valid `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and migrations.
