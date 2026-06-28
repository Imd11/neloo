# Legacy Notes

This directory stores historical implementation notes and one-off migration aids that are not part of the primary Neloo setup path.

New users should start with:

- `README.md`
- `docs/configuration.md`
- `ARCHITECTURE.md`
- `DEPLOY.md`

Archived files:

| File | Historical purpose |
| --- | --- |
| `COMMIT_MECHANISM_EXPLAINED.md` | Earlier explanation of file commit mechanics. |
| `MIGRATION_REPORT.md` | Historical migration report. |
| `THREAD_ID_DIAGRAM.md` | Earlier thread ID diagram. |
| `THREAD_ID_EXPLANATION.md` | Earlier thread ID notes. |
| `UPLOAD_FLOW_DIAGRAM.md` | Earlier upload flow diagram. |
| `UPLOAD_SESSIONS_EXPLAINED.md` | Earlier upload session explanation. |
| `supabase_fix_upload_sessions.sql` | One-off Supabase upload session migration script. |
| `supabase_fix_upload_sessions_v2.sql` | Later one-off Supabase upload session migration script. |

Review archived SQL carefully before running it against any database. Prefer the maintained migrations under `backend/supabase/migrations/` and `supabase/migrations/` when they cover your use case.
