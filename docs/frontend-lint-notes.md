# Frontend Lint Notes

The frontend currently has pre-existing lint debt that is outside the open-source configuration cleanup scope. GitHub Actions runs the frontend lint job from `.github/workflows/ci.yml`. The lint step is intentionally `continue-on-error: true` so existing debt stays visible without blocking unrelated open-source setup work.

The frontend formatting check is also report-only for now because `yarn format:check` currently reports existing Prettier debt. Build remains blocking.

Current known categories include unused imports/variables, hook dependency warnings, one hook-rule error, switch case declaration style, and stale eslint-disable comments.

Do not treat this as permission to add new lint errors. New frontend work should avoid increasing the lint error count.
