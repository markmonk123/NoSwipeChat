# NoSwipeChat Network Architecture

## Overview

All services now run on a shared Docker bridge network (`noswipechat-network`), enabling seamless inter-service communication using service names as hostnames.

## Container Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                    Docker Host (Your Machine)                    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          noswipechat-network (Docker Bridge)             │   │
│  │                                                           │   │
│  │   ┌──────────────────┐                                   │   │
│  │   │  nginx:8080      │◄────── localhost:8080 (External)  │   │
│  │   │  (Reverse Proxy) │                                   │   │
│  │   └────────┬─────────┘                                   │   │
│  │            │                                              │   │
│  │     ┌──────┴──────────────────┐                          │   │
│  │     │                         │                          │   │
│  │     ▼                         ▼                          │   │
│  │   ┌──────────────┐      ┌──────────────┐               │   │
│  │   │  backend     │      │  embeddings  │               │   │
│  │   │  :5000       │      │  :8000       │               │   │
│  │   │  (Node.js)   │      │  (Python)    │               │   │
│  │   └──────┬───────┘      └──────────────┘               │   │
│  │          │                                              │   │
│  │          ▼                                              │   │
│  │   ┌──────────────┐                                      │   │
│  │   │  mongo       │                                      │   │
│  │   │  :27017      │                                      │   │
│  │   │  (Database)  │                                      │   │
│  │   └──────────────┘                                      │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Communication Paths

### 1. Frontend (Browser) → Services

```
User Browser
    │
    └─→ [HTTP] localhost:8080
           │
           nginx (Reverse Proxy)
           │
        ┌──┴──┬──────────┐
        │     │          │
   [/api/*] [/socket.io] [/embeddings]
        │     │          │
        ▼     ▼          ▼
      backend:5000    embeddings:8000
```

### 2. Backend → Embeddings (Internal)

```
backend:5000
    │
    └─→ [HTTP] http://embeddings:8000
           │
           ├─ /health         (health check)
           ├─ /embed          (single text)
           └─ /embed-batch    (multiple texts)
```

### 3. Backend → MongoDB (Internal)

```
backend:5000
    │
    └─→ [MongoDB Protocol] mongodb://mongo:27017
           │
           Message collection
           User collection
           etc.
```

## Service Details

### 1. **nginx** (Reverse Proxy)
- **Port**: 8080 (exposed to host)
- **Role**: Entry point for all external traffic
- **Routes**:
  - `/` → Static frontend assets
  - `/api/*` → Proxies to `backend:5000`
  - `/socket.io/*` → WebSocket to `backend:5000`
  - `/embeddings/*` → Proxies to `embeddings:8000`
- **Network**: `noswipechat-network`
- **Restart Policy**: unless-stopped
- **Health**: Inherits from backend/embeddings health checks

### 2. **backend** (Node.js API Server)
- **Port**: 5000 (internal only, not exposed)
- **Role**: Main application logic, Socket.io server, embeddings orchestrator
- **Features**:
  - REST API endpoints (`/api/auth`, `/api/chat`, `/api/users`)
  - Real-time WebSocket via Socket.io
  - Message validation and compliance checks
  - Embeddings service integration
  - MongoDB connection
- **Network**: `noswipechat-network`
- **Dependencies**: mongo (healthcheck: service_healthy)
- **Environment Variables**:
  - `PORT=5000`
  - `MONGODB_URI=mongodb://mongo:27017/singles-chatroom`
  - `EMBEDDINGS_SERVICE_URL=http://embeddings:8000`
  - `SOCKET_IO_PATH=/socket.io`
  - etc.
- **Restart Policy**: unless-stopped

### 3. **embeddings** (Python RoBERTa Service)
- **Port**: 8000 (internal only, not exposed)
- **Role**: Text embedding generation using RoBERTa model
- **Endpoints**:
  - `GET /health` → Service health
  - `POST /embed` → Single text embedding (768-dim vector)
  - `POST /embed-batch` → Multiple texts
  - `POST /embed-pooled` → Mean-pooled embeddings
- **Model**: RoBERTa-base (transformers library)
- **GPU Support**: Optional (check Dockerfile comments)
- **Network**: `noswipechat-network`
- **Startup Time**: ~40 seconds (model loading)
- **Health Check**: Interval 30s, timeout 10s
- **Restart Policy**: unless-stopped

### 4. **mongo** (MongoDB Database)
- **Port**: 27017 (internal only, not exposed)
- **Role**: Data persistence
- **Database**: `singles-chatroom`
- **Collections**: users, messages, etc.
- **Volumes**: mongo-data (persistent)
- **Network**: `noswipechat-network`
- **Health Check**: mongosh ping command
- **Restart Policy**: unless-stopped

## DNS Resolution (Service Discovery)

Docker automatically provides DNS resolution for service names within the network:

```bash
# From any container on noswipechat-network:

backend    → resolves to internal IP (e.g., 172.18.0.2)
embeddings → resolves to internal IP (e.g., 172.18.0.3)
mongo      → resolves to internal IP (e.g., 172.18.0.4)
nginx      → resolves to internal IP (e.g., 172.18.0.5)
```

No need for environment variables or hardcoded IPs!

## Data Flow: Message with Embedding

```
1. User sends message via Socket.io
   Browser → nginx:8080 → backend:5000
   
2. Backend receives on 'send-message' event
   
3. Backend validates user
   backend → mongo:27017 (query user compliance)
   
4. Backend calls embeddings service
   backend → embeddings:8000 /embed (POST with message text)
   
5. Embeddings returns 768-dim vector
   embeddings → backend (JSON response)
   
6. Backend stores message in database
   backend → mongo:27017 (insert message + embedding digest)
   
7. Backend broadcasts to all clients in city
   backend → all Socket.io clients connected to city room
   (includes message text + embedding vector)
```

## Environment & Configuration

### Service Names (used in configuration)
- Service name acts as hostname within the network
- Format: `http://<service_name>:<port>`
- Examples:
  ```
  http://backend:5000
  http://embeddings:8000
  mongodb://mongo:27017
  http://nginx:8080  (internal reference only)
  ```

### Network Driver
- **Type**: Bridge (default)
- **Name**: `noswipechat-network`
- **Scope**: Local (single Docker host)
- **IP Range**: Docker-assigned (typically 172.18.0.0/16)

## Troubleshooting Reference

| Issue | Diagnosis Command | Common Causes |
|-------|-------------------|---------------|
| Backend can't reach embeddings | `docker exec noswipechat-backend curl http://embeddings:8000/health` | Service crashed, wrong port, DNS issue |
| Embeddings service unstable | `docker-compose logs embeddings` | OOM, model loading timeout, GPU issues |
| Database not accessible | `docker exec noswipechat-backend curl mongodb://mongo:27017` | MongoDB crashed, port conflict |
| Messages not getting embeddings | Backend logs: `grep "embedding" ` | Embeddings service unhealthy, network issue |
| Frontend can't reach API | `curl http://localhost:8080/api/health` | nginx crashed, backend down, port exposed wrong |
| Network isolated | `docker network inspect noswipechat_noswipechat-network` | Services on wrong network, network deleted |

## Scaling Considerations

### Current Setup (Single Host)
- Works for development and small deployments
- All services on one Docker bridge network
- Automatic service discovery via DNS

### For Production Scaling
Would require:
- Kubernetes (Compose → Helm charts)
- Service mesh (Istio for inter-service communication)
- Load balancer (NGINX Ingress or cloud LB)
- Database replication (MongoDB Replica Set)
- Embeddings service instances with queue (Redis/RabbitMQ)

Current docker-compose can be extended with:
```yaml
version: '3.8'
services:
  backend:
    deploy:
      replicas: 3  # Multiple instances
  nginx:
    ports:
      - "8080:8080"  # Already load-balances via DNS
```

## Key Network Characteristics

✅ **Advantages**
- Simple setup, no extra configuration needed
- Automatic DNS service discovery
- Services can't be reached from outside Docker (except nginx:8080)
- All internal traffic is encrypted (in production, use Compose secrets)
- Scales to single host easily

⚠️ **Limitations**
- Single Docker host only (not distributed)
- No built-in load balancing for service-to-service (use nginx ingress)
- Manual scaling (docker-compose scale)
- Database replication not configured
- No automatic failover

---

**Last Updated**: April 9, 2024
**Docker Version**: 5.1.1+ recommended
**Docker Compose Version**: 2.x+ required
