# syntax=docker/dockerfile:1
# Dockerfile — IBM Code Engine: Express REST API server
# Serves the HBF API on port 8080.

FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev --ignore-scripts

# Copy application code
COPY src/ ./src/
COPY Procfile ./

ENV NODE_ENV=production
ENV PORT=8080

# Non-root user for security
RUN addgroup -S api && adduser -S api -G api && chown -R api:api /app
USER api

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "src/server.js"]
