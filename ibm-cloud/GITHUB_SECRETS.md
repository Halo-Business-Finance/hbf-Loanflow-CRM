# IBM Cloud Migration — GitHub Actions Secrets Required

To use the IBM Cloud deployment pipeline, add these secrets to your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

## Required Secrets

| Secret Name | Description | Where to Find |
|-------------|-------------|---------------|
| `IBM_CLOUD_API_KEY` | IBM Cloud API key | IBM Cloud Console → Manage → Access (IAM) → API keys |
| `IBM_DB_CONNECTION_STRING` | PostgreSQL connection string | IBM Cloud → Databases for PostgreSQL → Service credentials |
| `IBM_APPID_JWKS_URI` | App ID JWKS endpoint | IBM App ID → Service credentials → oauthServerUrl + `/publickeys` |
| `IBM_APPID_ISSUER` | App ID token issuer | IBM App ID → Service credentials → oauthServerUrl |
| `IBM_COS_HMAC_ACCESS_KEY` | COS HMAC access key | IBM COS → Service credentials (with HMAC: true) → cos_hmac_keys.access_key_id |
| `IBM_COS_HMAC_SECRET_KEY` | COS HMAC secret key | IBM COS → Service credentials → cos_hmac_keys.secret_access_key |
| `IBM_COS_ENDPOINT` | COS endpoint | IBM COS → Endpoints → select region |

## Required Vite Build-Time Variables (also as GitHub Secrets)

| Secret Name | Description |
|-------------|-------------|
| `VITE_IBM_APPID_CLIENT_ID` | App ID client ID (from service credentials → clientId) |
| `VITE_IBM_APPID_DISCOVERY_ENDPOINT` | App ID discovery endpoint (oauthServerUrl + `/.well-known/openid-configuration`) |
| `VITE_IBM_FUNCTIONS_BASE_URL` | IBM Cloud Functions web actions base URL |
| `VITE_IBM_COS_ENDPOINT` | COS endpoint (public, safe for frontend) |
| `VITE_IBM_COS_INSTANCE_ID` | COS instance/resource ID |

## IBM Cloud Console — One-Time Setup Steps

1. **Create Resource Group**: `crm-production`
2. **Create Container Registry namespace**: `hbf-crm` (us region)
3. **Create registry pull secret** in Code Engine:
   ```bash
   ibmcloud ce secret create --format registry \
     --name icr-secret \
     --server us.icr.io \
     --username iamapikey \
     --password YOUR_IBM_CLOUD_API_KEY
   ```
4. **Create Code Engine project**: `crm-code-engine`
5. **Create IBM Cloud Functions namespace**: `crm`

## Triggering a Deployment

Push to `main` branch — the pipeline runs automatically:
1. Security scan (npm audit + Trivy)
2. Docker build + push to IBM Container Registry
3. IBM Cloud Functions deploy (db-gateway, storage-sign)
4. Code Engine frontend deploy
5. Health check verification
