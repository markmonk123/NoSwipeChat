# ─── Stage 1: Build React/Expo Web frontend ───────────────────────────────────
# This stage runs during `docker build` which has full internet access.
# npm install downloads all dependencies here; nothing is carried forward
# to the runtime image except the compiled static files.
FROM node:20-alpine AS frontend-build

WORKDIR /app

# Copy only manifest files first so Docker can cache the install layer
COPY frontend/package*.json ./
RUN npm ci

# Copy remaining frontend source and build for web
COPY frontend .
RUN npx expo export --platform web --output-dir dist

# ─── Stage 2: Runtime nginx image ─────────────────────────────────────────────
# Minimal Alpine-based nginx — no Node.js, no npm, no internet needed at runtime.
FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy our hardened nginx configs
COPY nginx/nginx.conf      /etc/nginx/nginx.conf
COPY nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

# Copy built frontend assets from Stage 1
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# nginx runs as non-root (pid 1 is still root for binding port 80, worker is nginx user)
EXPOSE 8080

# nginx:alpine ships with busybox which includes wget; use a simple HTTP check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
