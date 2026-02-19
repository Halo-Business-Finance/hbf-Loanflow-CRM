#!/usr/bin/env bash
# ============================================================================
# IBM Cloud Deployment Script — HBF LoanFlow CRM
# Full deployment to IBM Code Engine + IBM Container Registry
# ============================================================================
# Usage:
#   export IBM_CLOUD_API_KEY="your-api-key"
#   ./ibm-cloud/deploy.sh [production|staging]
# ============================================================================

set -euo pipefail

ENVIRONMENT="${1:-staging}"
REGION="${IBM_REGION:-us-south}"
RESOURCE_GROUP="${IBM_RESOURCE_GROUP:-crm-production}"
REGISTRY_NAMESPACE="hbf-crm"
# Image name must match what IBM Code Engine is configured to pull
IMAGE_NAME="hbf-crm"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo 'main')}"
# Push via public endpoint; Code Engine pulls via private endpoint using registry secret
FULL_IMAGE_PUBLIC="us.icr.io/${REGISTRY_NAMESPACE}/${IMAGE_NAME}:${IMAGE_TAG}"
FULL_IMAGE_PRIVATE="private.us.icr.io/${REGISTRY_NAMESPACE}/${IMAGE_NAME}:${IMAGE_TAG}"
CE_PROJECT="${IBM_CE_PROJECT:-crm-code-engine}"
# App name must match the Code Engine application name exactly
CE_APP_NAME="hbf-crm"

# ── Prerequisites Check ────────────────────────────────────────────────────
command -v ibmcloud &>/dev/null || { echo "ERROR: ibmcloud CLI not installed."; exit 1; }
command -v docker &>/dev/null    || { echo "ERROR: Docker not installed."; exit 1; }

echo "🚀 HBF LoanFlow CRM — IBM Cloud Deployment"
echo "   Environment : $ENVIRONMENT"
echo "   Region      : $REGION"
echo "   Push Image  : $FULL_IMAGE_PUBLIC"
echo "   CE Image    : $FULL_IMAGE_PRIVATE  (private endpoint for Code Engine)"
echo ""

# ── 1. IBM Cloud Login ─────────────────────────────────────────────────────
echo "▶ Logging in to IBM Cloud..."
ibmcloud login --apikey "${IBM_CLOUD_API_KEY}" -r "${REGION}" -g "${RESOURCE_GROUP}" -q

# Install plugins if missing
ibmcloud plugin list | grep -q "code-engine" || ibmcloud plugin install code-engine -f
ibmcloud plugin list | grep -q "container-registry" || ibmcloud plugin install container-registry -f

# ── 2. Container Registry ──────────────────────────────────────────────────
echo "▶ Authenticating with IBM Container Registry..."
ibmcloud cr login --client docker
ibmcloud cr namespace-add "${REGISTRY_NAMESPACE}" 2>/dev/null || true

# ── 3. Build & Push Docker Image ──────────────────────────────────────────
echo "▶ Building Docker image..."
docker build \
  --platform linux/amd64 \
  --build-arg VITE_IBM_APPID_CLIENT_ID="${VITE_IBM_APPID_CLIENT_ID:-}" \
  --build-arg VITE_IBM_APPID_DISCOVERY_ENDPOINT="${VITE_IBM_APPID_DISCOVERY_ENDPOINT:-}" \
  --build-arg VITE_IBM_FUNCTIONS_BASE_URL="${VITE_IBM_FUNCTIONS_BASE_URL:-}" \
  --build-arg VITE_IBM_COS_ENDPOINT="${VITE_IBM_COS_ENDPOINT:-}" \
  --build-arg VITE_IBM_COS_INSTANCE_ID="${VITE_IBM_COS_INSTANCE_ID:-}" \
  --build-arg VITE_IBM_REGION="${REGION}" \
  -f Dockerfile \
  -t "${FULL_IMAGE_PUBLIC}" \
  -t "us.icr.io/${REGISTRY_NAMESPACE}/${IMAGE_NAME}:main" \
  .

echo "▶ Pushing image to IBM Container Registry (public endpoint)..."
docker push "${FULL_IMAGE_PUBLIC}"
docker push "us.icr.io/${REGISTRY_NAMESPACE}/${IMAGE_NAME}:main"

# ── 4. Deploy IBM Cloud Functions ──────────────────────────────────────────
echo "▶ Deploying IBM Cloud Functions..."
FUNCTIONS=(db-gateway storage-sign storage-list storage-delete)

for fn in "${FUNCTIONS[@]}"; do
  FN_DIR="ibm-cloud/functions/${fn}"
  echo "  → Installing dependencies for ${fn}..."
  (cd "${FN_DIR}" && npm ci --ignore-scripts)

  echo "  → Zipping ${fn}..."
  (cd "${FN_DIR}" && zip -r "../${fn}.zip" . -x "*.md" -x ".git/*")

  echo "  → Deploying ${fn} to IBM Cloud Functions..."
  ibmcloud fn action update "crm/${fn}" \
    "ibm-cloud/functions/${fn}.zip" \
    --kind nodejs:20 \
    --web true \
    --timeout 60000 \
    --memory 512 \
    --param-file /dev/null 2>/dev/null || \
  ibmcloud fn action create "crm/${fn}" \
    "ibm-cloud/functions/${fn}.zip" \
    --kind nodejs:20 \
    --web true \
    --timeout 60000 \
    --memory 512

  # Set environment secrets (IAM preferred; set USE_HMAC=true to use HMAC instead)
  ibmcloud fn action update "crm/${fn}" \
    --param IBM_DB_CONNECTION_STRING "${IBM_DB_CONNECTION_STRING:-}" \
    --param IBM_COS_API_KEY          "${IBM_COS_API_KEY:-}" \
    --param IBM_COS_INSTANCE_ID      "${IBM_COS_INSTANCE_ID:-}" \
    --param IBM_COS_ENDPOINT         "${IBM_COS_ENDPOINT:-}" \
    --param IBM_COS_HMAC_ACCESS_KEY  "${IBM_COS_HMAC_ACCESS_KEY:-}" \
    --param IBM_COS_HMAC_SECRET_KEY  "${IBM_COS_HMAC_SECRET_KEY:-}" \
    --param USE_HMAC                 "${USE_HMAC:-false}" \
    --param IBM_APPID_JWKS_URI       "${IBM_APPID_JWKS_URI:-}" \
    --param IBM_APPID_ISSUER         "${IBM_APPID_ISSUER:-}"

  rm -f "ibm-cloud/functions/${fn}.zip"
done

# ── 5. Deploy to IBM Code Engine ──────────────────────────────────────────
echo "▶ Deploying frontend to IBM Code Engine..."
ibmcloud ce project select --name "${CE_PROJECT}" || \
  ibmcloud ce project create --name "${CE_PROJECT}"

# Code Engine must reference the image via the PRIVATE registry endpoint.
# The registry secret 'hbf-crm' provides credentials for private.us.icr.io.
ibmcloud ce application update \
  --name "${CE_APP_NAME}" \
  --image "${FULL_IMAGE_PRIVATE}" \
  --registry-secret hbf-crm \
  --port 8080 \
  --min-scale 1 \
  --max-scale 10 \
  --cpu 0.5 \
  --memory 1G 2>/dev/null || \
ibmcloud ce application create \
  --name "${CE_APP_NAME}" \
  --image "${FULL_IMAGE_PRIVATE}" \
  --registry-secret hbf-crm \
  --port 8080 \
  --min-scale 1 \
  --max-scale 10 \
  --cpu 0.5 \
  --memory 1G

# ── 6. Get URL ─────────────────────────────────────────────────────────────
echo ""
echo "✅ Deployment complete!"
APP_URL=$(ibmcloud ce application get --name "${CE_APP_NAME}" --output json 2>/dev/null \
  | python3 -c "import sys,json; a=json.load(sys.stdin); print(a.get('status',{}).get('url',''))" 2>/dev/null \
  || echo "Run: ibmcloud ce application get --name ${CE_APP_NAME}")
echo "   🌐 Application URL: ${APP_URL}"
echo "   📦 Push image : ${FULL_IMAGE_PUBLIC}"
echo "   📦 CE image   : ${FULL_IMAGE_PRIVATE}"
echo ""
echo "Next steps:"
echo "  1. Add IBM App ID redirect URI: ${APP_URL}/auth/callback"
echo "  2. Set IBM_DB_CONNECTION_STRING in IBM Secrets Manager"
echo "  3. Configure custom domain in IBM Code Engine"
