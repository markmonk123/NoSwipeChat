
- description: "Use when editing docker compose, nginx, or container networking config. Enforce a single external entrypoint through nginx and keep backend services internal-only in NoSwipeChat."
- name: "Networking Guardrails"
- applyTo:
  - docker-compose.yml
  - compose.yaml
  - compose.debug.yaml
  - frontend/nginx.conf
  - nginx/nginx.conf
  - nginx/conf.d/*.conf
  - nginx/Dockerfile
---
# Networking Guardrails

## External Entry Point Policy

- Keep nginx as the only public ingress for application traffic.
- Prefer a single host-exposed app port through nginx (port `8080`) unless a change request explicitly requires additional public ports.
- Route frontend, API, and socket traffic through nginx path-based proxying instead of exposing backend service ports directly.

## Internal-Only Service Exposure

- Keep backend (`5000`), embeddings (`8000`), and mongo (`27017`) internal-only in compose.
- Use `expose` (or internal network visibility) for service-to-service communication, not host `ports` bindings, for non-nginx services.
- Do not publish backend, embeddings, or mongo to host unless explicitly requested and documented in comments.

## Network Topology Rules

- Preserve split-network design where applicable:
  - external network for nginx ingress
  - internal-only network for backend, embeddings, and mongo
- If a service must join both networks, nginx is the default bridge service.
- Avoid adding internet egress paths to internal services unless explicitly required.

## nginx Reverse Proxy Expectations

- Keep `/api/*` and `/socket.io/*` proxied to backend service host/port used by compose.
- Keep embeddings proxy path aligned with compose service name/port when enabled.
- Do not hardcode host IPs; use compose service DNS names (for example `backend`, `embeddings`).
- Preserve SPA fallback behavior for frontend routing.

## Consistency Checks After Networking Changes

- Validate host entrypoint:
  - `curl http://localhost:8080/`
  - `curl http://localhost:8080/api/health`
  - `curl http://localhost:8080/api/status`
- Validate that non-nginx services are not host-exposed unexpectedly:
  - `docker compose -f docker-compose.yml ps`
- Validate socket path still works through nginx (`/socket.io/*`).

## Change Safety

- Prefer minimal diffs in compose/nginx files and avoid broad refactors while changing networking.
- Keep service names and upstream references synchronized between compose and nginx config.
- If a networking change requires opening additional host ports, document the reason in file comments near the port mapping.
