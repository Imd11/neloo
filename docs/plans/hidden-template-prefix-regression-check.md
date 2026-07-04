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

## Execution Results - 2026-07-05

- Frontend URL: `http://localhost:3000`
- Backend URL: `http://127.0.0.1:2024`
- Homepage load: PASS. The page loaded with backend connected, and visible page text did not include `You are a senior prompt engineer.`, `Act like a professional content writer`, `Analysis direction:`, or `[System: You are now acting as the agent`.
- Prompt Optimize submit: PASS for visible UI. Submitted `make a landing page hero prompt`; the user bubble showed only that text, the assistant response rendered normally, and visible page text did not include hidden template prefixes.
- Prompt Optimize refresh/history response: SKIPPED/PARTIAL. Reloading the generated `threadId` showed `未找到对话` because the local thread persistence API could not create a durable thread in this environment. Observed `/api/threads` responses did not contain hidden prompt prefixes.
- Humanize submit/history: PASS for visible UI. Submitted `This innovative solution leverages cutting-edge technology to enhance productivity.`; the user bubble showed only that text, and visible page text did not include the humanize system prompt.
- Fortune submit/history: PARTIAL. The UI blocked submission with `请先填写完整的出生信息再发送。`; no model request was sent, and visible page text did not include `Analysis direction:`.
- Regenerate: PASS for visible UI. Regenerated a Prompt Optimize response; the user bubble still showed only the original user text, and visible page text did not include hidden template prefixes.
- Fork/regenerate: SKIPPED. The local thread persistence API returned `500` for thread creation and `404` for the generated thread IDs, so a durable fork target was unavailable.
- Share page/API: SKIPPED/PARTIAL. The share flow could not complete because the local thread persistence API returned `500` for `/api/threads` and `404` for the generated thread. Captured thread API responses did not contain hidden prompt prefixes.
- DB spot check: SKIPPED. The local persistence layer did not create durable thread rows in this environment, so there was no reliable DB row to inspect.
- Model stream note: The LangGraph realtime `/runs/stream` response includes the model-facing hidden prompt during generation. This is expected with the current architecture because the browser submits model input to the LangGraph stream, but it is not persisted in the frontend DB save path and was not visible in chat bubbles, copy-visible text, regenerate-visible text, or thread API error/history responses observed here.
- Blockers or skipped checks: Durable refresh/history, fork/regenerate, share page, and DB spot checks were blocked by local thread persistence failures: `/api/threads` returned `500: Failed to create thread`, and generated thread IDs returned `404: Thread not found`.
