# Single image: builds the React frontend and serves it from the Node API.
FROM node:24-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
COPY backend/migrations ./migrations
COPY --from=web /web/dist ./public
ENV FRONTEND_DIST=/app/public UPLOAD_DIR=/app/uploads PORT=4000
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "src/server.js"]
