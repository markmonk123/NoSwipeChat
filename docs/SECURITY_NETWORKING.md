# NoSwipeChat – Secure Networking & NGINX Reverse Proxy

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Docker Host                                    │
│                                                                        │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │      noswipechat-external  (bridge – HAS internet access)    │   │
│   │                                                                │   │
│   │   ┌──────────────────────────────────────────────────────┐   │   │
│   │   │  nginx :8080  (only externally exposed port)         │   │   │
│   │   │  ── accepts inbound HTTP from host/internet          │   │   │
│   │   │  ── bridges BOTH networks                            │   │   │
│   │   └──────────────────┬───────────────────────────────────┘   │   │
│   └──────────────────────│───────────────────────────────────────┘   │
│                           │ (nginx is the only container on          │
│                           │  both networks)                           │
│   ┌───────────────────────▼──────────────────────────────────────┐   │
│   │    noswipechat-internal  (bridge, internal:true – NO internet)│   │
│   │                                                                │   │
│   │  ┌─────────────┐  ┌─────────────────┐  ┌──────────────────┐  │   │
│   │  │  backend    │  │   embeddings    │  │    mongo         │  │   │
│   │  │  :5000      │  │   :8000         │  │   :27017         │  │   │
│   │  │  (Node.js)  │  │   (Python)      │  │  (MongoDB)       │  │   │
│   │  └─────────────┘  └─────────────────┘  └──────────────────┘  │   │
│   │                                                                │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

### Traffic Flows

| Initiator        | Destination                   | Network              |
|------------------|-------------------------------|----------------------|
| Browser/internet | `nginx:8080`                  | external             |
| `nginx`          | `backend:5000`  (`/api/*`)    | internal             |
| `nginx`          | `backend:5000`  (`/socket.io/*`) | internal          |
| `nginx`          | `embeddings:8000` (`/embeddings/*`) | internal      |
| `backend`        | `mongo:27017`                 | internal             |
| `backend`        | `embeddings:8000`             | internal             |
| `nginx`          | internet (OAuth redirects)    | external             |
| `backend`        | ~~internet~~ **BLOCKED**      | internal only        |
| `embeddings`     | ~~internet~~ **BLOCKED**      | internal only        |
| `mongo`          | ~~internet~~ **BLOCKED**      | internal only        |

---

## 2. Network Isolation Mechanism

### `internal: true` flag

Setting `internal: true` on a Docker bridge network instructs Docker **not to add a default gateway** to that network's interface (`docker0` or a `br-*` bridge). Without a default route, containers on that network cannot route packets to the internet.

```yaml
networks:
  noswipechat-internal:
    driver: bridge
    internal: true   # ← removes default gateway, no internet access
```

This is enforced at the kernel routing level via `iptables` / `nftables` rules that Docker injects:
- No `MASQUERADE` rule for the internal bridge → no NAT for outbound traffic.
- A `DOCKER-ISOLATION` chain drop rule prevents cross-network forwarding unless explicitly connected.

### Why this is better than firewall rules in containers

- **No privilege escalation**: containers cannot override host-level iptables rules.
- **Immutable at runtime**: network topology is set at compose startup; containers cannot rejoin a different network without restart.
- **Zero config in app code**: apps don't need to know they are isolated.

---

## 3. Build-Time vs. Runtime Internet Access

### The challenge

`npm install` and `pip install` require internet access, but we want runtime containers to be isolated.

### The solution: multi-stage Dockerfiles

Docker image builds **always** have internet access, regardless of the runtime network the resulting container will be placed on. This is because `docker build` runs in the host's default network namespace (or a separate `bridge` network) that has full internet access.

```
docker build  ──(internet available)──► compiled image
                     ↓
docker run   ──(internal: true network)──► runtime container (no internet)
```

#### nginx / frontend (`nginx/Dockerfile`)

```dockerfile
# Stage 1: build – has internet access
FROM node:20-alpine AS frontend-build
RUN npm ci           # ← internet ✓

# Stage 2: runtime – no internet needed
FROM nginx:1.27-alpine
COPY --from=frontend-build /app/dist /usr/share/nginx/html
# Nothing in this stage needs internet
```

#### backend (`backend/Dockerfile`)

```dockerfile
FROM node:20-alpine
RUN npm install --omit=dev   # ← build time, internet ✓
# At runtime this container is on noswipechat-internal only
```

#### embeddings (`Dockerfile`)

```dockerfile
FROM python:3.11-slim AS builder
RUN pip install -r requirements.txt   # ← build time, internet ✓

FROM python:3.11-slim
COPY --from=builder /usr/local/lib/python3.11/site-packages ...
# Runtime image: no pip, no internet needed
```

### Updating dependencies

When you need to upgrade a package:

```bash
# 1. Update the lock file locally (on a machine with internet)
cd backend && npm update <package>

# 2. Rebuild just that service (build still has internet access)
docker compose build backend

# 3. Recreate the service
docker compose up -d --no-deps backend
```

No special network changes are needed because `docker build` always has internet.

---

## 4. NGINX Configuration

### 4a. Reverse proxy routing

All external traffic enters through nginx on port 8080 and is proxied to internal services:

| Route              | Upstream              | Notes                      |
|--------------------|-----------------------|----------------------------|
| `/api/*`           | `backend:5000`        | REST API; auth rate limit  |
| `/api/auth/*`      | `backend:5000`        | 5 req/s per IP (stricter)  |
| `/socket.io/*`     | `backend:5000`        | WebSocket upgrade          |
| `/embeddings/*`    | `embeddings:8000`     | ML inference; 120s timeout |
| `/*`               | static files in image | SPA fallback               |

### 4b. Security headers

Every response includes:

| Header                         | Value                                          |
|--------------------------------|------------------------------------------------|
| `X-Frame-Options`              | `SAMEORIGIN`                                   |
| `X-Content-Type-Options`       | `nosniff`                                      |
| `X-XSS-Protection`             | `1; mode=block`                                |
| `Referrer-Policy`              | `strict-origin-when-cross-origin`              |
| `Strict-Transport-Security`    | `max-age=31536000; includeSubDomains`          |
| `Permissions-Policy`           | `geolocation=(self), camera=(), microphone=()` |
| `Content-Security-Policy`      | See `nginx/conf.d/default.conf`                |

### 4c. Rate limiting

Two zones defined in `nginx/nginx.conf`:

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m  rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/s;
```

- `/api/` – 30 req/s, burst 60
- `/api/auth/` – 5 req/s, burst 10 (brute-force protection)

### 4d. Deferred DNS resolution

nginx resolves upstream names at **request time** (not startup):

```nginx
resolver 127.0.0.11 valid=10s ipv6=off;
set $backend_upstream    "http://backend:5000";
set $embeddings_upstream "http://embeddings:8000";
```

This means nginx starts successfully even if `backend` or `embeddings` is not yet ready, and automatically picks up any IP changes.

---

## 5. Docker Compose Network Policy – Lifecycle Summary

| Phase                  | Network access for build/runtime containers                  |
|------------------------|--------------------------------------------------------------|
| `docker compose build` | **Full internet** – pip/npm install succeeds                 |
| Container startup      | Only nginx gets external network; others: internal only      |
| Runtime                | `backend`, `embeddings`, `mongo` – **no internet**           |
| Runtime                | `nginx` – has internet (required for OAuth callbacks)        |
| Dependency update      | `docker compose build <service>` – internet available again  |

---

## 6. Port Exposure Summary

| Service      | Host port | Internal expose | Internet access |
|--------------|-----------|-----------------|-----------------|
| `nginx`      | 8080      | –               | ✅ yes          |
| `backend`    | –         | 5000            | ❌ no           |
| `embeddings` | –         | 8000            | ❌ no           |
| `mongo`      | –         | 27017           | ❌ no           |

Only `nginx:8080` is bound to the host. All other services are reachable **only through nginx** or by other containers on the internal network.

---

## 7. Trade-offs & Alternatives

### Trade-off 1: `internal: true` vs. egress firewall rules

| Approach                    | Pros                              | Cons                               |
|-----------------------------|-----------------------------------|------------------------------------|
| `internal: true` (chosen)   | Zero-config, kernel-enforced      | All internet blocked (no partial)  |
| Host `iptables` rules        | Fine-grained (allow specific IPs) | Requires host-level privilege      |
| Container-level firewall     | Per-container control             | Containers can override as root    |

For this use case (no external calls from backend/embeddings at runtime), `internal: true` is the simplest and most secure option.

### Trade-off 2: pre-built frontend image vs. bind mounts

| Approach                    | Pros                                     | Cons                        |
|-----------------------------|------------------------------------------|-----------------------------|
| Multi-stage Dockerfile (chosen) | Self-contained image; no host deps   | Longer build time           |
| Bind mount `./frontend/dist` | Fast iteration during development        | Requires local `npm run build` |

The multi-stage approach is chosen for production. For local development, bind mounts remain usable with `docker compose -f compose.yaml` (the simpler dev file).

### Trade-off 3: Single nginx config vs. separate dev/prod configs

The `frontend/nginx.conf` file is kept as a simpler, reusable config (no rate limiting) for development convenience. The production `nginx/conf.d/default.conf` includes rate limiting and full security headers.

---

## 8. Future Automation

### Renovate / Dependabot for automatic dependency PRs

Enable GitHub Dependabot in `.github/dependabot.yml` to auto-open PRs when npm/pip packages have updates. The PR triggers `docker compose build` in CI which has internet access, then the built image (no internet at runtime) is deployed.

### CI/CD build pipeline

```yaml
# Conceptual GitHub Actions step
- name: Build images
  run: docker compose build
  # Runs in GitHub-hosted runner which has internet access
  # Resulting images are pushed to a registry (GHCR / ECR)

- name: Deploy
  run: docker compose up -d
  # Pulls pre-built images – no internet needed at runtime
```

### Health check integration

All services expose `/health` endpoints checked by Docker and nginx. Add a Prometheus + Grafana stack to `noswipechat-internal` for monitoring without internet exposure.
