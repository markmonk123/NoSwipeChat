FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend .

RUN npx expo export --platform web --output-dir dist

FROM nginx:1.27-alpine

ARG BACKEND_UPSTREAM=backend:5000

COPY frontend/nginx.conf /tmp/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

RUN sed "s|__BACKEND_UPSTREAM__|${BACKEND_UPSTREAM}|g" /tmp/default.conf > /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
