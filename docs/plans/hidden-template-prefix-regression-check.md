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
