# NoSwipeChat Inter-VM Communication Setup

## Summary of Changes

I've configured your NoSwipeChat application to enable all services (backend, embeddings, mongo, nginx) to communicate with each other on a shared Docker network. Here's what was implemented:

### 1. Unified Docker Compose Network

**File: `docker-compose.yml`** (NEW)
- Replaced individual compose files with a single unified configuration
- All services now run on a shared `noswipechat-network` bridge network
- Service discovery via DNS (services can reference each other by name)

**Services in the network:**
- `mongo` - MongoDB database (internal only, port 27017)
- `backend` - Node.js server (internal only, port 5000)
- `embeddings` - Python RoBERTa embeddings (internal only, port 8000)
- `nginx` - Reverse proxy (exposed on port 8080)

### 2. Backend Integration with Embeddings

**File: `backend/src/utils/embeddings.js`** (NEW)
- Helper utility for calling the RoBERTa embeddings service
- Functions:
  - `getTextEmbedding(text)` - Get embedding for single text
  - `getTextEmbeddingsBatch(texts)` - Get embeddings for multiple texts
  - `checkEmbeddingsServiceHealth()` - Health check

**File: `backend/src/server.js`** (UPDATED)
- Integrated embeddings service calls into the `send-message` Socket.io handler
- When a user sends a city message, the backend now:
  1. Validates user compliance
  2. Stores message in MongoDB
  3. Calls embeddings service to get message embedding (768-dim RoBERTa vector)
  4. Broadcasts message + embedding digest to all clients in that city
- Added `/status` endpoint to check inter-service connectivity
- Health monitoring of embeddings service (polls every 30 seconds)

**Environment Variables:**
- `EMBEDDINGS_SERVICE_URL=http://embeddings:8000` - Set automatically in compose

### 3. Nginx Reverse Proxy Updates

**File: `frontend/nginx.conf`** (UPDATED)
- Added `/embeddings/` route that proxies to embeddings service
- Frontend can call `/embeddings/embed` via nginx instead of calling backend
- All headers properly forwarded (Host, X-Real-IP, X-Forwarded-For, etc.)

### 4. Backend Dockerfile Fix

**File: `backend/Dockerfile`** (UPDATED)
- Fixed COPY paths (was incorrectly copying from root)
- Now properly copies from `backend/` directory
- Changed PORT from 8080 to 5000 to match backend service definition

## How Services Communicate

### Internal Service-to-Service (on docker network)

1. **Backend → MongoDB**
   ```javascript
   MONGODB_URI: mongodb://mongo:27017/singles-chatroom
   ```

2. **Backend → Embeddings Service**
   ```javascript
   const embeddings = await getTextEmbedding(message);
   // Internally calls: http://embeddings:8000/embed
   ```

3. **Nginx → Backend**
   ```nginx
   proxy_pass http://backend:5000;  # Service name auto-resolved on Docker network
   ```

4. **Nginx → Embeddings** (if frontend calls directly)
   ```nginx
   location /embeddings/ {
     proxy_pass http://embeddings:8000/;
   }
   ```

### External Client Communication

1. **Browser → Nginx (8080)**
   - Static frontend assets
   - All `/api/*` routes proxied to backend:5000
   - `/socket.io/*` WebSocket proxied to backend:5000
   - `/embeddings/*` (if frontend needs direct access) proxied to embeddings:8000

## Message Flow Diagram

```
Browser/Client
   │
   ├── (static assets) ──→ nginx:8080 ──→ (serves /usr/share/nginx/html)
   │
   ├── (Socket.io messages) ──→ nginx:8080 ──→ backend:5000
   │                                          │
   │                                          ├── (compliance check) ──→ mongo:27017
   │                                          │
   │                                          └── (embed message) ──→ embeddings:8000
   │                                             (RoBERTa model)
   │
   └── (optional direct embeddings call) ──→ nginx:8080 ──→ embeddings:8000
```

## Testing Inter-Service Communication

### 1. Check all services are running

```bash
docker-compose ps
```

Expected output:
```
CONTAINER ID   IMAGE                         NAMES
...            mongo:7                       noswipechat-mongo
...            noswipechat-backend          noswipechat-backend
...            noswipechat-embeddings       noswipechat-embeddings
...            nginx:alpine                  noswipechat-nginx
```

### 2. Test embeddings health from backend

```bash
docker exec noswipechat-backend curl http://embeddings:8000/health
```

Expected output:
```json
{"status": "ok", "model": "roberta-base", "device": "cpu"}
```

### 3. Test backend status endpoint

```bash
curl http://localhost:8080/api/status
```

Expected output:
```json
{
  "backend": { "status": "running", "port": 5000 },
  "embeddings": { "status": "healthy", "url": "http://embeddings:8000" },
  "timestamp": "2024-..."
}
```

### 4. Test message embedding (via Socket.io)

- Send a message from frontend
- Check backend logs for embedding call:
  ```
  docker-compose logs backend | grep -i embedding
  ```

- Message payload should include `embeddingDigest`:
  ```json
  {
    "userId": "...",
    "message": "hello world",
    "embeddingDigest": [0.123, -0.456, ...],  // 768 values
    "timestamp": "..."
  }
  ```

### 5. Direct embeddings API test (through nginx)

```bash
curl -X POST http://localhost:8080/embeddings/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "test message"}'
```

Expected output:
```json
{
  "embedding": [...],  // 768 floats
  "shape": [1, 768]
}
```

## Current Build Issue

**Note:** There's currently an SSL certificate verification issue when building the embeddings Docker image. This is a system-level SSL issue in your Docker environment (common on macOS Docker Desktop).

**Workaround options:**
1. Update Docker Desktop to the latest version
2. Configure Docker to use a system certificate bundle
3. Skip the Docker build step and run services locally during development

Once you resolve the SSL issue, run:
```bash
docker-compose build --no-cache
docker-compose up -d
```

## Files Modified

- ✅ `docker-compose.yml` - NEW (unified network config)
- ✅ `frontend/nginx.conf` - UPDATED (added /embeddings route)
- ✅ `backend/src/utils/embeddings.js` - NEW (embeddings service client)
- ✅ `backend/src/server.js` - UPDATED (integrated embeddings calls + status endpoint)
- ✅ `backend/Dockerfile` - UPDATED (fixed COPY paths)
- ✅ `Dockerfile` - UPDATED (fixed Python dependency installation)
- ✅ `NETWORKING.md` - NEW (detailed architecture documentation)

## Next Steps

1. **Resolve SSL build issue** (system-level Docker fix needed)
2. **Build and test**: `docker-compose build && docker-compose up`
3. **Test embeddings integration**: Send a city message, verify embedding digest included
4. **Monitor**: Check `docker-compose logs backend` and `docker-compose logs embeddings`
5. **Scale if needed**: Use `docker-compose up -d --scale backend=2` for load balancing

## Direct Service Communication (for debugging)

All services can now directly communicate without going through nginx:

```bash
# From backend to embeddings
docker exec noswipechat-backend curl -X POST http://embeddings:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "test"}'

# From embeddings to backend (if needed)
docker exec noswipechat-embeddings curl http://backend:5000/health

# From any service to mongo
docker exec noswipechat-backend mongosh --host mongo --eval "db.adminCommand('ping')"
```

---

**Architecture: Bridge Network with DNS Service Discovery**
- All containers share `noswipechat-network`
- Docker embedded DNS server resolves service names to container IPs
- No need for hardcoded IPs or environment variables for host:port
- Scales to multiple instances automatically
