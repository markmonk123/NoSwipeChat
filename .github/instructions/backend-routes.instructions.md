---
description: "Use when editing backend routes, server route mounting, or middleware chains. Enforce root and /api route parity, auth middleware ordering, and consistent async/error handling in NoSwipeChat backend files."
name: "Backend Route And Middleware Rules"
applyTo:
  - backend/src/server.js
  - backend/src/routes/**/*.js
  - backend/src/middleware/**/*.js
---
# Backend Route And Middleware Rules

## Route Parity In Server Mounts

- When adding or renaming a top-level router, mount it in both forms in [backend/src/server.js](backend/src/server.js):
  - root path, for example `/users`
  - `/api`-prefixed path, for example `/api/users`
- Keep parity for shared utility endpoints too when intended for both paths, following existing patterns such as `/health` and `/api/health`.
- Do not introduce new backend routes that are only reachable via one prefix unless explicitly required and documented in code comments.

## Middleware Order In Server

- Keep global middleware order consistent in [backend/src/server.js](backend/src/server.js):
  1. CORS and body parsers
  2. route mounts
  3. error handler (last)
- Keep `app.use(errorHandler)` after route declarations so route and async errors propagate correctly.

## Middleware Chain Order In Routes

- For protected route handlers, middleware order must be:
  1. `authMiddleware`
  2. optional policy middleware (for example `complianceMiddleware`)
  3. `asyncHandler(async (...) => { ... })`
- Never place `asyncHandler` before `authMiddleware`.
- Prefer route-level middleware composition over manual auth checks inside handlers.

## Error Handling Consistency

- Wrap async route handlers with `asyncHandler` from [backend/src/middleware/errorHandler.js](backend/src/middleware/errorHandler.js).
- Return structured JSON errors through normal `throw`/`next(err)` flow to the centralized `errorHandler`.
- Keep response shape from the global error handler consistent:
  - `{ error: { status, message } }`
- Avoid ad hoc error payload formats unless a route has a documented compatibility requirement.

## Verification Checklist After Route Changes

- Confirm new/updated routes are reachable through both root and `/api` mounts when applicable.
- Confirm protected routes still enforce auth before compliance checks.
- Confirm async handler errors are returned by centralized error middleware.
- Smoke test through nginx pathing:
  - `curl http://localhost:8080/api/health`
  - `curl http://localhost:8080/api/status`
