---
description: "Use when editing frontend screens, components, API calls, or socket setup. Enforce runtime URL resolution, avoid hardcoded localhost endpoints, and keep web/native compatibility in NoSwipeChat frontend files."
name: "Frontend Runtime URL Rules"
applyTo: "frontend/**/*.{js,jsx,ts,tsx}"
---
# Frontend Runtime Rules

- Always use URL and socket helpers from [frontend/config/runtime.js](frontend/config/runtime.js).
- For REST calls, build endpoints through buildApiUrl instead of string literals.
- For socket setup, use SOCKET_URL and SOCKET_PATH from runtime config.
- Never hardcode localhost, 127.0.0.1, backend container names, or absolute API origins inside screens/components.
- Keep behavior compatible across web and native targets. Do not assume window exists outside web.
- If a public config value is needed, consume existing helper flow via /api/config/public through runtime utilities.

## Required Checks After Frontend Endpoint Changes

- Confirm frontend route loads through nginx at [frontend/nginx.conf](frontend/nginx.conf).
- Verify API requests succeed via /api paths behind nginx.
- Verify socket path remains /socket.io unless explicitly changed in backend and runtime config.
- Validate that no new hardcoded endpoint strings were added in frontend files.

## Cross-File Parity

- If frontend socket or API path changes, keep parity with backend config in [backend/src/server.js](backend/src/server.js).
- Keep CORS-related origin assumptions aligned with compose environment in [docker-compose.yml](docker-compose.yml).
