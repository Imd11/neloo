# Frontend Lint Notes

The frontend currently has pre-existing lint debt that is outside the open-source configuration cleanup scope. CI keeps the lint job visible but non-blocking until the lint backlog is resolved.

Current known categories include unused imports/variables, hook dependency warnings, one hook-rule error, switch case declaration style, and stale eslint-disable comments.

Do not treat this as permission to add new lint errors. New frontend work should avoid increasing the lint error count.
