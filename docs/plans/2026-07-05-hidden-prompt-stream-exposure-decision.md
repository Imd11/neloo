# Hidden Prompt Stream Exposure Decision

## Current Fact

Neloo currently sends model-facing template prompt content from the browser to the LangGraph realtime `/runs/stream` endpoint. The hidden text is not intended to appear in chat bubbles, copy output, saved human message content, history API human content, or share API human content after the sanitizer repairs, but it can still be observed by a user inspecting their own browser network traffic during generation.

## Decision

Accepted for this release.

## Rationale

The current repair scope is display and persistence safety: do not show or save template instructions as user-visible conversation content. It is not a secrecy boundary against the local browser owner. This keeps the fix small and avoids introducing a server-side prompt proxy into a persistence regression repair.

## Required Wording

Do not claim template prompts are secret from the local user. Describe the current behavior as:

- hidden from visible chat UI, copy, history, and share output
- sanitized before frontend DB save paths
- still model-facing during realtime generation

## Future Work If This Becomes Unacceptable

Create a separate server-side proxy plan. The browser should send only visible user input plus a feature/template id to the backend, and the backend should assemble model-facing prompts server-side before calling LangGraph or model providers.
