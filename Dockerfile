# syntax=docker/dockerfile:1
# Dockerfile — IBM Code Engine: HBF CRM Frontend
# Multi-stage build: Vite → nginx on port 8080

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Accept build-time env vars for Vite
ARG VITE_IBM_APPID_CLIENT_ID
ARG VITE_IBM_APPID_DISCOVERY_ENDPOINT
ARG VITE_IBM_FUNCTIONS_BASE_URL
ARG VITE_IBM_FUNCTIONS_API_KEY

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback config
RUN printf 'server {\n\
  listen 8080;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
  location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {\n\
    expires 1y;\n\
    add_header Cache-Control "public, immutable";\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
