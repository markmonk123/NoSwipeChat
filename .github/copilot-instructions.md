# Project Guidelines

## Architecture
- This repo is a multi-service app: frontend (Expo web) + Node backend + Python embeddings + MongoDB + nginx reverse proxy.
- Treat nginx as the public entrypoint on port 8080. Backend (5000), embeddings (8000), and mongo (27017) are internal services.
- Prefer current network and routing design documented in [NETWORKING.md](NETWORKING.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
- For security/network policy details, use [docs/SECURITY_NETWORKING.md](docs/SECURITY_NETWORKING.md).

## Build And Run
- Canonical full-stack command set:
  - `docker compose -f docker-compose.yml up -d --build`
  - `docker compose -f docker-compose.yml ps`
  - `docker compose -f docker-compose.yml logs -f nginx backend embeddings mongo`
  - `docker compose -f docker-compose.yml down`
- Use `compose.debug.yaml` only when explicitly asked for debug/development compose behavior.
- Frontend web build (when needed outside nginx image build):
  - `cd frontend && npx expo export --platform web --output-dir dist`
- Backend local dev:
  - `cd backend && npm install && npm run dev`

## Testing
- There is no real automated unit/integration test suite yet (`npm test` in frontend/backend is currently a placeholder).
- For verification, run smoke checks against running services:
  - `curl http://localhost:8080/`
  - `curl http://localhost:8080/api/health`
  - `curl http://localhost:8080/api/status`
- When changing networking/proxy behavior, verify both `/api/*` and `/socket.io/*` paths through nginx.

## Conventions
- Frontend API and socket endpoints must come from [frontend/config/runtime.js](frontend/config/runtime.js). Do not hardcode localhost URLs in screens/components.
- Backend routes are mounted both root and `/api` prefixed in [backend/src/server.js](backend/src/server.js). Keep parity when adding routes.
- CORS origins are controlled by `FRONTEND_URLS` (comma-separated). Preserve Codespaces support via `CODESPACE_PUBLIC_URL` where applicable.
- Keep nginx upstream routing in [frontend/nginx.conf](frontend/nginx.conf) aligned with backend and embeddings service names/ports.

## Documentation Priority
- Prefer these as source of truth before editing:
  - [NETWORKING.md](NETWORKING.md)
  - [ARCHITECTURE.md](ARCHITECTURE.md)
  - [COMMANDS.sh](COMMANDS.sh)
  - [docs/SECURITY_NETWORKING.md](docs/SECURITY_NETWORKING.md)
- [README.md](README.md) and [SETUP_GUIDE.md](SETUP_GUIDE.md) may contain outdated naming or setup details; verify against compose files and current service configs before applying changes.

## Safety Checks Before Finalizing
- After code/config edits, run at least one relevant command (build, compose up, or curl smoke checks) and report results.
- If Docker networking/firewall rules are changed, validate container-to-container traffic still works and host access remains on intended ports.
