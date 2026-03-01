# HBF-API — Backend REST Gateway

Express.js API gateway for the Halo Business Finance CRM, deployed on IBM Code Engine.

## Architecture

- **Runtime**: Node.js 20 + Express 4
- **Database**: IBM Cloud Databases for PostgreSQL
- **Storage**: IBM Cloud Object Storage (COS) via `ibm-cos-sdk`
- **Auth**: PBKDF2 password hashing + HS256 JWT tokens
- **JWT Verification**: IBM App ID JWKS (RS256) for enterprise SSO tokens

## Quick Start

```bash
cp .env.example .env   # Fill in your values
npm install
npm start              # Listens on :8080
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `CRM_API_KEY` | ✅ | Shared API key for frontend auth |
| `JWT_SECRET` | ✅ | Secret for HS256 token signing |
| `IBM_APPID_DISCOVERY_ENDPOINT` | For SSO | App ID OIDC discovery URL |
| `IBM_APPID_CLIENT_ID` | For SSO | App ID client ID |
| `IBM_COS_API_KEY` | For storage | COS IAM API key |
| `IBM_COS_INSTANCE_ID` | For storage | COS service instance ID |
| `IBM_COS_ENDPOINT` | For storage | COS S3 endpoint (default: `s3.us-south.cloud-object-storage.appdomain.cloud`) |

## API Routes

### Auth (no API key required)
- `POST /api/v1/auth/register` — Create account
- `POST /api/v1/auth/login` — Authenticate & get tokens
- `POST /api/v1/auth/refresh` — Refresh access token
- `POST /api/v1/auth/reset-password` — Request password reset
- `POST /api/v1/auth/update-password` — Set new password

### Storage
- `POST /api/v1/storage-sign` — Get signed upload/download URL
- `POST /api/v1/storage-list` — List objects in bucket
- `POST /api/v1/storage-delete` — Delete objects

### CRUD Resources
All require `x-api-key` header:
- `/api/v1/leads`, `/api/v1/contact-entities`, `/api/v1/lenders`
- `/api/v1/clients`, `/api/v1/service-providers`, `/api/v1/profiles`
- `/api/v1/messages`, `/api/v1/tasks`, `/api/v1/lead-documents`
- `/api/v1/document-templates`, `/api/v1/document-versions`
- `/api/v1/email-accounts`, `/api/v1/approval-requests`, `/api/v1/approval-steps`
- Plus 20+ additional tables via crud-factory

### RPC Endpoints
- `/api/v1/roles/*`, `/api/v1/security/*`, `/api/v1/sessions/*`
- `/api/v1/documents/*`, `/api/v1/data/*`, `/api/v1/mfa/*`
- `/api/v1/reports/*`, `/api/v1/pipeline/*`, `/api/v1/compliance/*`
- Generic fallback: `POST /api/v1/rpc/:fn_name`

### Edge Function Routes (JWT-protected)
- `/api/v1/functions/admin-users/*`
- `/api/v1/functions/microsoft-auth/*`
- `/api/v1/functions/security/*`
- `/api/v1/functions/documents/*`
- `/api/v1/functions/integrations/*`

## Deployment

```bash
# IBM Code Engine (from project root)
ibmcloud ce application update -n hbf-api --build-source . --no-wait

# Or via Docker
docker build -t hbf-api .
docker run -p 8080:8080 --env-file .env hbf-api
```

## Database Migrations

Run migrations in order against your PostgreSQL instance:

```bash
psql $DATABASE_URL -f src/migrations/001_create_users_table.sql
```
