FROM node:20-alpine

WORKDIR /app

# Copy package files from backend directory
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy entire backend source
COPY backend ./

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "src/server.js"]
