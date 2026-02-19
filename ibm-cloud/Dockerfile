# syntax=docker/dockerfile:1
# IBM Code Engine / IBM Container Registry deployment image
# Builds the React/Vite CRM and serves it with nginx

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# IBM Cloud environment variables injected at build time via --build-arg
ARG VITE_IBM_APPID_CLIENT_ID
ARG VITE_IBM_APPID_DISCOVERY_ENDPOINT
ARG VITE_IBM_FUNCTIONS_BASE_URL
ARG VITE_IBM_FUNCTIONS_API_KEY
ARG VITE_IBM_COS_ENDPOINT
ARG VITE_IBM_COS_INSTANCE_ID
ARG VITE_IBM_COS_BUCKET_DOCUMENTS
ARG VITE_IBM_COS_BUCKET_TEMPLATES
ARG VITE_IBM_EVENT_STREAMS_BROKERS
ARG VITE_IBM_WATSONX_URL
ARG VITE_IBM_WATSONX_PROJECT_ID
ARG VITE_IBM_REGION
ARG VITE_IBM_CE_NAMESPACE

# Supabase vars (kept during migration phase — remove when fully migrated)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID

ENV VITE_IBM_APPID_CLIENT_ID=$VITE_IBM_APPID_CLIENT_ID
ENV VITE_IBM_APPID_DISCOVERY_ENDPOINT=$VITE_IBM_APPID_DISCOVERY_ENDPOINT
ENV VITE_IBM_FUNCTIONS_BASE_URL=$VITE_IBM_FUNCTIONS_BASE_URL
ENV VITE_IBM_FUNCTIONS_API_KEY=$VITE_IBM_FUNCTIONS_API_KEY
ENV VITE_IBM_COS_ENDPOINT=$VITE_IBM_COS_ENDPOINT
ENV VITE_IBM_COS_INSTANCE_ID=$VITE_IBM_COS_INSTANCE_ID
ENV VITE_IBM_COS_BUCKET_DOCUMENTS=$VITE_IBM_COS_BUCKET_DOCUMENTS
ENV VITE_IBM_COS_BUCKET_TEMPLATES=$VITE_IBM_COS_BUCKET_TEMPLATES
ENV VITE_IBM_EVENT_STREAMS_BROKERS=$VITE_IBM_EVENT_STREAMS_BROKERS
ENV VITE_IBM_WATSONX_URL=$VITE_IBM_WATSONX_URL
ENV VITE_IBM_WATSONX_PROJECT_ID=$VITE_IBM_WATSONX_PROJECT_ID
ENV VITE_IBM_REGION=$VITE_IBM_REGION
ENV VITE_IBM_CE_NAMESPACE=$VITE_IBM_CE_NAMESPACE
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Security: run nginx as non-root
RUN addgroup -S crm && adduser -S crm -G crm
RUN chown -R crm:crm /var/cache/nginx /var/log/nginx /etc/nginx/conf.d
RUN touch /var/run/nginx.pid && chown crm:crm /var/run/nginx.pid

# Copy nginx config
COPY ibm-cloud/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built app
COPY --from=builder /app/dist /usr/share/nginx/html
RUN chown -R crm:crm /usr/share/nginx/html

USER crm

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
