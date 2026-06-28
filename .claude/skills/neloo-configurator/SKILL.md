---
name: neloo-configurator
description: Discovery wrapper for configuring the Neloo open-source project environment from Claude Code. Use when setting up backend/.env, frontend/.env.local, Railway, Vercel, Supabase, E2B, chat model keys, image generation keys, or diagnosing Neloo environment variables.
---

# Neloo Configurator Wrapper

This is a discovery wrapper for Claude Code tools that scan `.claude/skills`. It points to the Neloo environment setup assistant; it is not a runtime skill loaded by the Neloo app.

Use the canonical skill at:

```text
../../../neloo-configurator/SKILL.md
```

Read and follow that file before configuring Neloo. Do not duplicate configuration logic in this wrapper.
