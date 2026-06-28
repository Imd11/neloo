# Open Source Secret Audit

Date: 2026-06-28

Scope: Git-tracked repository files in this checkout. Local ignored files such as `.env`, `.env.local`, `.vercel/`, virtual environments, and build output were not copied into this report.

## Result

No real API token, service-role key, database password, private key, or local personal filesystem path was found in tracked project files during this audit.

The scan found only expected template/configuration examples:

- `backend/.env.example`
- `frontend/.env.example`
- Dynamic Postgres connection-string construction in `backend/start.py`
- The repository copyright holder in `LICENSE`

## Checks Performed

Tracked private-config path scan:

```bash
git ls-files | rg '(^|/)\.env($|\.)|\.env\.local|\.mcp\.json$|(^|/)\.vercel/|\.pem$|id_rsa|id_dsa|\.p12$|\.key$'
```

Tracked secret-pattern scan:

```bash
git grep -n -I -E 'sk-[A-Za-z0-9_-]{20,}|e2b_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|postgres(ql)?://[^[:space:]]+:[^[:space:]]+@|mongodb(\+srv)?://[^[:space:]]+:[^[:space:]]+@|mysql://[^[:space:]]+:[^[:space:]]+@|redis://[^[:space:]]+:[^[:space:]]+@' -- . ':!frontend/yarn.lock'
```

Tracked personal/project-identity scan:

- Local home-directory paths and local shell-style usernames.
- Old package names and old upstream UI project names.
- Old public product identity phrases that should no longer appear in current user-facing docs.

Local tool availability check:

```bash
command -v gitleaks
command -v trufflehog
```

Neither command was available in this local environment, so this audit did not perform a full-history external secret scan.

## Gitignore Hardening

`.gitignore` now excludes common local secret and key material:

- `.env`, `.env.local`, `.env.*.local`, `.envrc`
- `.mcp.json`, `backend/.mcp.json`
- `.vercel`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`
- `id_rsa*`, `id_dsa*`, `id_ed25519*`

## Manual Open Source Checklist

Before making the repository public:

1. Rotate any key that has ever existed in local `.env`, `.env.local`, Railway, Vercel, Supabase, E2B, or provider dashboards if there is any chance it was shared outside your machine.
2. Confirm GitHub repository secrets, Railway variables, Vercel variables, Supabase service keys, and provider API keys are not shown in screenshots, issues, README text, or commit messages.
3. Run an external scanner such as GitHub secret scanning, Gitleaks, or TruffleHog against the full Git history if the repository has ever contained real secrets.
4. Keep `NEXT_PUBLIC_*` values restricted because they are browser-visible by design.
5. Do not commit local `.env` files, `.mcp.json`, `.vercel/`, generated databases, model binaries, or local build output.
