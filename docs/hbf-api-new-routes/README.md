# New hbf-api Routes for CRM Integration

These files add REST endpoints for 13 CRM tables that don't have
dedicated routes in hbf-api yet.

## Installation (in your hbf-api project)

### 1. Run the DDL migration
```bash
psql "$DATABASE_URL" -f migration.sql
```
Or paste the contents of `migration.sql` into your DB console.

### 2. Copy files
```bash
cp crud-factory.js       docs/hbf-api-starter/src/routes/crud-factory.js
cp routes/lenders.js     docs/hbf-api-starter/src/routes/lenders.js
cp routes/clients.js     docs/hbf-api-starter/src/routes/clients.js
cp routes/service-providers.js docs/hbf-api-starter/src/routes/service-providers.js
cp routes/profiles.js    docs/hbf-api-starter/src/routes/profiles.js
cp routes/messages.js    docs/hbf-api-starter/src/routes/messages.js
cp routes/tasks.js       docs/hbf-api-starter/src/routes/tasks.js
cp routes/lead-documents.js docs/hbf-api-starter/src/routes/lead-documents.js
cp routes/document-templates.js docs/hbf-api-starter/src/routes/document-templates.js
cp routes/document-versions.js  docs/hbf-api-starter/src/routes/document-versions.js
cp routes/email-accounts.js     docs/hbf-api-starter/src/routes/email-accounts.js
cp routes/approval-requests.js  docs/hbf-api-starter/src/routes/approval-requests.js
cp routes/approval-steps.js     docs/hbf-api-starter/src/routes/approval-steps.js
```

### 3. Mount in server.js
Add to the require block and apiRouter.use() calls (see `mount-snippet.js`).

### 4. Redeploy hbf-api
```bash
ibmcloud ce application update -n hbf-api --build-source .
```
