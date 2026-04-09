# NoSwipeChat Multi-Service Networking

## Architecture Overview

Your application now uses a **shared Docker network** (`noswipechat-network`) that enables all services to communicate with each other via service names as hostnames.

```
┌─────────────────────────────────────────────────────────────┐
│                      noswipechat-network                    │
│                       (Docker bridge)                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐             │
│  │  nginx   │────▶│ backend  │◀───▶│  mongo   │             │
│  │ :8080    │     │ :5000    │     │ :27017   │             │
│  └──────────┘     └──────────┘     └──────────┘             │
│       ▲                 ▲                                     │
│       │                 │                                     │
│       └─────────────────┼─────────────────┐                  │
│                         │                 │                  │
│                    ┌────▼──────┐          │                  │
│                    │embeddings  │          │                  │
│                    │ :8000      │          │                  │
│                    └────────────┘          │                  │
│                                            │                  │
│  Communication flow:                       │                  │
│  • Frontend (browser) → nginx → backend    │                  │
│  • nginx → embeddings (/embeddings route)  │                  │
│  • backend → embeddings (internal)         │                  │
│  • backend → mongo (internal)              │                  │
│                                            │                  │
└────────────────────────────────────────────────────────────────┘
```

## Service Communication

### Service Names (DNS Resolution on Docker Network)
All services can reach each other using their service names as hostnames:

- **mongo**: `mongodb://mongo:27017` (from backend)
- **backend**: `http://backend:5000` (from nginx, embeddings)
- **embeddings**: `http://embeddings:8000` (from backend, nginx)
- **nginx**: `http://nginx:8080` (external entry point)

### Port Exposure

- **nginx** (8080) - Only port exposed to host. Serves:
  - Frontend static assets
  - `/api/*` → proxies to backend:5000
  - `/socket.io/*` → proxies to backend:5000 (WebSocket)
  - `/embeddings/*` → proxies to embeddings:8000

- **backend** (5000) - Internal only (no host port binding)
  - REST API endpoints (`/api/auth`, `/api/chat`, `/api/users`)
  - Socket.io real-time communication
  - Communicates with mongo:27017 (internal)
  - Communicates with embeddings:8000 (internal)

- **embeddings** (8000) - Internal only
  - `/health` - Health check
  - `/embed` - Single text embedding
  - `/embed-batch` - Batch embeddings
  - `/embed-pooled` - Pooled embeddings

- **mongo** (27017) - Internal only
  - Database access from backend only

## Message Flow with Embeddings

### City Message with Embedding Digest

1. **Frontend sends message** via Socket.io to backend
2. **Backend receives** `send-message` event
3. **Backend checks compliance** via database (mongo)
4. **Backend calls embeddings service**:
   ```
   POST http://embeddings:8000/embed
   { "text": "message content" }
   ```
5. **Embeddings service** (RoBERTa model) returns 768-dim vector
6. **Backend broadcasts** message + embedding digest to all clients in city:
   ```json
   {
     "userId": "...",
     "userName": "...",
     "message": "...",
     "embeddingDigest": [...],  // 768-element array
     "timestamp": "..."
   }
   ```
7. **Frontend receives** message and embedding digest via Socket.io

## Environment Variables

### Backend

- `EMBEDDINGS_SERVICE_URL=http://embeddings:8000` - **IMPORTANT**: Must use service name on internal network
- `MONGODB_URI=mongodb://mongo:27017/singles-chatroom` - **IMPORTANT**: Must use service name
- Other standard vars: `JWT_SECRET`, `FACEBOOK_APP_ID`, etc.

### Nginx

The docker-compose automatically substitutes:
- `__BACKEND_UPSTREAM__` → `backend:5000`
- `__EMBEDDINGS_UPSTREAM__` → `embeddings:8000`

## Debugging Inter-Service Communication

### Check Service Health

```bash
# From your host
docker-compose ps                    # View all service status
docker-compose logs backend          # View backend logs
docker-compose logs embeddings       # View embeddings logs
docker-compose logs nginx            # View nginx logs

# From within a container (docker exec)
docker exec noswipechat-backend curl http://embeddings:8000/health
docker exec noswipechat-backend curl http://mongo:27017
docker exec noswipechat-embeddings curl http://localhost:8000/health
```

### Test Embeddings Service

```bash
# From host machine (through nginx)
curl -X POST http://localhost:8080/embeddings/health
curl -X POST http://localhost:8080/embeddings/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "hello world"}'

# From backend container (direct)
docker exec noswipechat-backend curl http://embeddings:8000/health
docker exec noswipechat-backend curl -X POST http://embeddings:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "hello world"}'
```

### Check Network Connectivity

```bash
# Inspect the Docker network
docker network inspect noswipechat_noswipechat-network

# All services should be listed with their internal IPs
```

## Troubleshooting

### Services Can't Find Each Other

**Symptom**: Logs show "Failed to get embedding" or connection refused

**Solutions**:
1. Ensure all services are on the same network in docker-compose.yml
2. Use service names (not IPs) for inter-service communication
3. Check service is healthy: `docker-compose logs <service>`
4. Verify correct ports in docker-compose (use `expose:` not `ports:` for internal)

### Frontend Can't Reach Backend

**Symptom**: 404 or connection errors on `/api/*` routes

**Solutions**:
1. Check nginx conf: `__BACKEND_UPSTREAM__` must be replaced with `backend:5000`
2. Verify backend service is running: `docker-compose ps`
3. Check nginx routing: `docker-compose logs nginx`
4. Frontend URL CORS config in backend must include nginx address

### Embeddings Service Unreachable

**Symptom**: Messages sent without embeddings; logs show health check failing

**Solutions**:
1. Check embeddings service logs: `docker-compose logs embeddings`
2. Verify RoBERTa model loaded correctly
3. Check Python dependencies: `docker-compose exec embeddings pip list`
4. Monitor health checks: `docker-compose ps embeddings`
5. Backend health endpoint: `curl http://localhost:8080/api/status`

## Upgrading Docker Compose Configuration

To upgrade services:

```bash
# Pull latest images
docker-compose pull

# Rebuild and recreate services
docker-compose up --build

# View logs
docker-compose logs -f

# Scale services (if needed in future)
docker-compose up -d --scale backend=2
```

## Production Considerations

1. **Use named volumes** for data persistence (mongo-data already configured)
2. **Set resource limits** in docker-compose for memory/CPU
3. **Use environment files**: Create `.env` file with production secrets
4. **Network isolation**: Consider using only internal networks (remove `ports:` from non-entry services)
5. **Load balancing**: For multiple backend instances, add a dedicated proxy
6. **Logging**: Configure centralized logging (ELK, Splunk, CloudWatch)
7. **Monitoring**: Add healthchecks and monitoring for embeddings service (GPU memory)
