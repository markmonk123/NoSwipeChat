FROM node:20-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend ./
RUN npx expo export --platform web --output-dir dist

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache nginx

COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev

COPY backend ./

WORKDIR /app
COPY --from=frontend-build /frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/http.d/default.conf

RUN sed -i 's|__BACKEND_UPSTREAM__|127.0.0.1:5000|g' /etc/nginx/http.d/default.conf \
  && mkdir -p /run/nginx

ENV NODE_ENV=production
ENV PORT=5000
ENV SOCKET_IO_PATH=/socket.io

EXPOSE 8080
EXPOSE 5000

WORKDIR /app/backend

CMD ["sh", "-c", "node src/server.js & backend_pid=$!; nginx -g 'daemon off;' & nginx_pid=$!; while kill -0 $backend_pid 2>/dev/null && kill -0 $nginx_pid 2>/dev/null; do sleep 1; done; kill $backend_pid $nginx_pid 2>/dev/null || true; wait $backend_pid"]
