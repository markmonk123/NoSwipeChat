# NoSwipeChat Multi-Service Networking

> **See [`docs/SECURITY_NETWORKING.md`](docs/SECURITY_NETWORKING.md) for the full security networking guide,
> trade-off analysis, and automation recommendations.**

## Architecture Overview

The stack uses **two Docker networks** to enforce runtime internet isolation:

```
┌──────────────────────────────────────────────────────────────────┐
│                       Docker Host                                 │
│                                                                    │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  noswipechat-external  (bridge – has internet access)     │   │
│  │                                                            │   │
│  │   ┌──────────────────────────────────────────────────┐   │   │
│  │   │  nginx :8080  ← only port exposed to the world   │   │   │
│  │   └────────────────────┬─────────────────────────────┘   │   │
│  └────────────────────────│────────────────────────────────── ┘  │
│                            │ (nginx bridges BOTH networks)        │
│  ┌─────────────────────────▼──────────────────────────────────┐  │
│  │  noswipechat-internal  (bridge, internal:true – NO internet) │  │
│  │                                                              │  │
│  │   ┌──────────┐   ┌────────────┐   ┌──────────────────┐    │  │
│  │   │ backend  │   │ embeddings │   │      mongo       │    │  │
│  │   │  :5000   │   │   :8000    │   │     :27017       │    │  │
│  │   └──────────┘   └────────────┘   └──────────────────┘    │  │
│  └──────────────────────────────────────────────────────────── ┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Key Properties

| Network                 | `internal: true` | Internet access | Services                        |
|-------------------------|------------------|-----------------|---------------------------------|
| `noswipechat-external`  | no               | ✅ yes          | nginx                           |
| `noswipechat-internal`  | **yes**          | ❌ no           | backend, embeddings, mongo      |

- **nginx** is on **both** networks: it accepts traffic from the internet and proxies it to internal services.
- **backend**, **embeddings**, and **mongo** are on the internal-only network and cannot initiate outbound internet connections at runtime.
- Internet access during build (`npm install`, `pip install`) is unaffected — Docker builds always run with internet access.

## Service Communication

### DNS (Docker internal)
Services resolve each other by service name via Docker's embedded DNS (`127.0.0.11`):

| From       | To           | Address                         |
|------------|--------------|---------------------------------|
| nginx      | backend      | `http://backend:5000`           |
| nginx      | embeddings   | `http://embeddings:8000`        |
| backend    | mongo        | `mongodb://mongo:27017`         |
| backend    | embeddings   | `http://embeddings:8000`        |

### nginx Routing

| External path      | Internal upstream      |
|--------------------|------------------------|
| `/api/*`           | `backend:5000`         |
| `/api/auth/*`      | `backend:5000` (rate-limited) |
| `/socket.io/*`     | `backend:5000` (WebSocket)    |
| `/embeddings/*`    | `embeddings:8000`      |
| `/*`               | static files (built into nginx image) |

## Port Exposure

| Service      | Host port | Exposed internally | Internet access |
|--------------|-----------|---------------------|-----------------|
| nginx        | **8080**  | –                   | ✅ yes          |
| backend      | –         | 5000                | ❌ no           |
| embeddings   | –         | 8000                | ❌ no           |
| mongo        | –         | 27017               | ❌ no           |

## Debugging

```bash
# Service status
docker compose ps

# Logs
docker compose logs nginx
docker compose logs backend
docker compose logs embeddings

# Verify internal container cannot reach internet
docker exec noswipechat-backend wget -q --spider https://example.com || echo "BLOCKED (expected)"

# Verify nginx can reach upstream services
docker exec noswipechat-nginx wget -q -O- http://backend:5000/api/status
docker exec noswipechat-nginx wget -q -O- http://embeddings:8000/health

# Test through nginx from host
curl http://localhost:8080/api/status
curl -X POST http://localhost:8080/embeddings/health
```

## Updating Dependencies

Dependencies are installed at `docker build` time (internet always available during build):

```bash
# Rebuild a specific service after updating package.json / requirements.txt
docker compose build backend
docker compose up -d --no-deps backend
```

See [`docs/SECURITY_NETWORKING.md`](docs/SECURITY_NETWORKING.md) for full details on trade-offs and CI/CD automation.
