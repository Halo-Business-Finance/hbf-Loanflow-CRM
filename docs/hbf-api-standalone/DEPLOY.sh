#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# HBF-API — Complete Setup Script
# Paste this ENTIRE script into IBM Cloud Shell to create the Express API,
# push to GitHub, and redeploy on Code Engine.
# ══════════════════════════════════════════════════════════════════════════════
set -e

cd ~/hbf-api
echo "▶ Backing up old frontend code..."
git checkout -b backup-frontend 2>/dev/null || true
git add -A && git commit -m "backup: frontend code before API conversion" --allow-empty 2>/dev/null || true
git push origin backup-frontend 2>/dev/null || true
git checkout main

echo "▶ Clearing old files..."
find . -maxdepth 1 ! -name '.git' ! -name '.' -exec rm -rf {} +

# ══════════════════════════════════════════════════════════════════════════════
# package.json
# ══════════════════════════════════════════════════════════════════════════════
cat > package.json << 'ENDFILE'
{
  "name": "hbf-api",
  "version": "1.0.0",
  "private": true,
  "engines": { "node": ">=20" },
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "pg": "^8.13.0",
    "uuid": "^10.0.0",
    "cors": "^2.8.5"
  }
}
ENDFILE

# ══════════════════════════════════════════════════════════════════════════════
# Procfile (for buildpack detection)
# ══════════════════════════════════════════════════════════════════════════════
cat > Procfile << 'ENDFILE'
web: node src/server.js
ENDFILE

# ══════════════════════════════════════════════════════════════════════════════
# .gitignore
# ══════════════════════════════════════════════════════════════════════════════
cat > .gitignore << 'ENDFILE'
node_modules/
.env
*.log
ENDFILE

# ══════════════════════════════════════════════════════════════════════════════
# Dockerfile
# ══════════════════════════════════════════════════════════════════════════════
cat > Dockerfile << 'ENDFILE'
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
EXPOSE 8080
ENV PORT=8080
USER node
CMD ["node", "src/server.js"]
ENDFILE

# ══════════════════════════════════════════════════════════════════════════════
# src/db.js — PostgreSQL connection pool
# ══════════════════════════════════════════════════════════════════════════════
mkdir -p src/routes

cat > src/db.js << 'ENDFILE'
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

let pool;

async function initDb() {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    console.warn('⚠️  DATABASE_URL not set — DB calls will fail');
    return;
  }
  pool = new Pool({
    connectionString: cs,
    ssl: process.env.DATABASE_SSL === 'false'
      ? false
      : { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  pool.on('error', (err) => console.error('Unexpected pool error', err));
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('✅ PostgreSQL connected');
  } finally {
    client.release();
  }
}

async function query(sql, params = []) {
  if (!pool) throw new Error('Database not initialized');
  const result = await pool.query(sql, params);
  return result.rows;
}

module.exports = { initDb, query, uuidv4 };
ENDFILE

# ══════════════════════════════════════════════════════════════════════════════
# src/crud-factory.js — Generic CRUD route generator
# ══════════════════════════════════════════════════════════════════════════════
cat > src/crud-factory.js << 'ENDFILE'
const express = require('express');
const { query, uuidv4 } = require('./db');

/**
 * Creates a standard CRUD router for a database table.
 *
 * @param {Object} opts
 * @param {string} opts.table          - PostgreSQL table name
 * @param {string[]} opts.filterParams - Query-string params mapped to WHERE clauses
 * @param {string[]} opts.requiredFields - Fields required on POST
 * @param {boolean} opts.allowDelete   - Whether DELETE endpoint is enabled
 */
function crudRoutes({ table, filterParams = [], requiredFields = [], allowDelete = false }) {
  const router = express.Router();

  // ── LIST ──────────────────────────────────────────────────────────────────
  router.get('/', async (req, res) => {
    try {
      let sql = `SELECT * FROM "${table}" WHERE 1=1`;
      const params = [];
      let idx = 1;

      for (const fp of filterParams) {
        if (req.query[fp] !== undefined) {
          sql += ` AND "${fp}" = $${idx++}`;
          params.push(req.query[fp]);
        }
      }

      // Search support: ?search=term searches common text columns
      if (req.query.search) {
        sql += ` AND "${table}"::text ILIKE $${idx++}`;
        params.push(`%${req.query.search}%`);
      }

      const orderCol = req.query.order_by || 'created_at';
      const orderDir = req.query.order_dir === 'asc' ? 'ASC' : 'DESC';
      if (/^[a-z_]+$/i.test(orderCol)) {
        sql += ` ORDER BY "${orderCol}" ${orderDir}`;
      } else {
        sql += ` ORDER BY "created_at" DESC`;
      }

      const limit = Math.min(parseInt(req.query.limit) || 100, 500);
      const offset = parseInt(req.query.offset) || 0;
      sql += ` LIMIT ${limit} OFFSET ${offset}`;

      const rows = await query(sql, params);
      res.json({ data: rows, count: rows.length });
    } catch (e) {
      console.error(`[${table}] GET error:`, e.message);
      res.status(500).json({ error: { message: 'Internal error', detail: e.message } });
    }
  });

  // ── GET BY ID ─────────────────────────────────────────────────────────────
  router.get('/:id', async (req, res) => {
    try {
      const rows = await query(`SELECT * FROM "${table}" WHERE id = $1`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: { message: 'Not found' } });
      res.json(rows[0]);
    } catch (e) {
      console.error(`[${table}] GET/:id error:`, e.message);
      res.status(500).json({ error: { message: 'Internal error' } });
    }
  });

  // ── CREATE ────────────────────────────────────────────────────────────────
  router.post('/', async (req, res) => {
    try {
      for (const f of requiredFields) {
        if (req.body[f] === undefined || req.body[f] === null || req.body[f] === '') {
          return res.status(400).json({ error: { message: `Missing required field: ${f}` } });
        }
      }

      const id = req.body.id || uuidv4();
      const now = new Date().toISOString();
      const record = { ...req.body, id, created_at: now, updated_at: now };

      const cols = Object.keys(record).filter((k) => record[k] !== undefined);
      const vals = cols.map((k) =>
        typeof record[k] === 'object' && record[k] !== null
          ? JSON.stringify(record[k])
          : record[k]
      );

      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const colNames = cols.map((c) => `"${c}"`).join(', ');

      await query(`INSERT INTO "${table}" (${colNames}) VALUES (${placeholders})`, vals);

      const rows = await query(`SELECT * FROM "${table}" WHERE id = $1`, [id]);
      res.status(201).json(rows[0] || record);
    } catch (e) {
      console.error(`[${table}] POST error:`, e.message);
      if (e.code === '23505') return res.status(409).json({ error: { message: 'Duplicate record' } });
      if (e.code === '23503') return res.status(400).json({ error: { message: 'Foreign key violation', detail: e.detail } });
      res.status(500).json({ error: { message: 'Internal error', detail: e.message } });
    }
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────
  router.put('/:id', async (req, res) => {
    try {
      const existing = await query(`SELECT id FROM "${table}" WHERE id = $1`, [req.params.id]);
      if (!existing.length) return res.status(404).json({ error: { message: 'Not found' } });

      const updates = { ...req.body, updated_at: new Date().toISOString() };
      delete updates.id;
      delete updates.created_at;

      const keys = Object.keys(updates);
      if (!keys.length) return res.status(400).json({ error: { message: 'No fields to update' } });

      const vals = keys.map((k) =>
        typeof updates[k] === 'object' && updates[k] !== null
          ? JSON.stringify(updates[k])
          : updates[k]
      );
      vals.push(req.params.id);

      const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
      await query(`UPDATE "${table}" SET ${setClause} WHERE id = $${keys.length + 1}`, vals);

      const rows = await query(`SELECT * FROM "${table}" WHERE id = $1`, [req.params.id]);
      res.json(rows[0]);
    } catch (e) {
      console.error(`[${table}] PUT error:`, e.message);
      res.status(500).json({ error: { message: 'Internal error', detail: e.message } });
    }
  });

  // ── PATCH (partial update) ────────────────────────────────────────────────
  router.patch('/:id', async (req, res) => {
    try {
      const existing = await query(`SELECT id FROM "${table}" WHERE id = $1`, [req.params.id]);
      if (!existing.length) return res.status(404).json({ error: { message: 'Not found' } });

      const updates = { ...req.body, updated_at: new Date().toISOString() };
      delete updates.id;
      delete updates.created_at;

      const keys = Object.keys(updates);
      if (!keys.length) return res.status(400).json({ error: { message: 'No fields to update' } });

      const vals = keys.map((k) =>
        typeof updates[k] === 'object' && updates[k] !== null
          ? JSON.stringify(updates[k])
          : updates[k]
      );
      vals.push(req.params.id);

      const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
      await query(`UPDATE "${table}" SET ${setClause} WHERE id = $${keys.length + 1}`, vals);

      const rows = await query(`SELECT * FROM "${table}" WHERE id = $1`, [req.params.id]);
      res.json(rows[0]);
    } catch (e) {
      console.error(`[${table}] PATCH error:`, e.message);
      res.status(500).json({ error: { message: 'Internal error', detail: e.message } });
    }
  });

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (allowDelete) {
    router.delete('/:id', async (req, res) => {
      try {
        const existing = await query(`SELECT id FROM "${table}" WHERE id = $1`, [req.params.id]);
        if (!existing.length) return res.status(404).json({ error: { message: 'Not found' } });
        await query(`DELETE FROM "${table}" WHERE id = $1`, [req.params.id]);
        res.json({ success: true, id: req.params.id });
      } catch (e) {
        console.error(`[${table}] DELETE error:`, e.message);
        if (e.code === '23503') return res.status(400).json({ error: { message: 'Cannot delete — referenced by other records' } });
        res.status(500).json({ error: { message: 'Internal error' } });
      }
    });
  }

  return router;
}

module.exports = crudRoutes;
ENDFILE

# ══════════════════════════════════════════════════════════════════════════════
# src/server.js — Main Express server
# ══════════════════════════════════════════════════════════════════════════════
cat > src/server.js << 'ENDFILE'
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://hbf-crm.23oqh4gja5d5.us-south.codeengine.appdomain.cloud',
    'https://hbf-portal.23oqh4gja5d5.us-south.codeengine.appdomain.cloud',
    'https://hbf-website.23oqh4gja5d5.us-south.codeengine.appdomain.cloud',
    'https://crm.halobusinessfinance.com',
    'https://portal.halobusinessfinance.com',
    'https://www.halobusinessfinance.com',
    'https://halobusinessfinance.com',
    /\.lovable\.app$/,
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ── Request logging ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// ── API Key authentication ──────────────────────────────────────────────────
app.use('/api/v1', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expected = process.env.CRM_API_KEY;
  // If CRM_API_KEY is set, enforce it; otherwise allow (dev mode)
  if (expected && apiKey !== expected) {
    return res.status(401).json({ error: { message: 'Unauthorized — invalid or missing API key' } });
  }
  next();
});

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'hbf-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── API Routes ──────────────────────────────────────────────────────────────
const api = express.Router();

// Core CRM tables
api.use('/leads',              require('./routes/leads'));
api.use('/contact-entities',   require('./routes/contact-entities'));
api.use('/lenders',            require('./routes/lenders'));
api.use('/clients',            require('./routes/clients'));
api.use('/service-providers',  require('./routes/service-providers'));
api.use('/profiles',           require('./routes/profiles'));

// Communication
api.use('/messages',           require('./routes/messages'));
api.use('/tasks',              require('./routes/tasks'));

// Documents
api.use('/lead-documents',     require('./routes/lead-documents'));
api.use('/document-templates', require('./routes/document-templates'));
api.use('/document-versions',  require('./routes/document-versions'));

// Email & Approvals
api.use('/email-accounts',     require('./routes/email-accounts'));
api.use('/approval-requests',  require('./routes/approval-requests'));
api.use('/approval-steps',     require('./routes/approval-steps'));

// Loan pipeline
api.use('/additional-borrowers', require('./routes/additional-borrowers'));
api.use('/cases',              require('./routes/cases'));
api.use('/case-comments',      require('./routes/case-comments'));

app.use('/api/v1', api);

// ── 404 catch-all ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.path}` } });
});

// ── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: { message: 'Internal server error' } });
});

// ── Start ───────────────────────────────────────────────────────────────────
initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 hbf-api running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
ENDFILE

# ══════════════════════════════════════════════════════════════════════════════
# Route files — one per table
# ══════════════════════════════════════════════════════════════════════════════

cat > src/routes/leads.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'leads',
  filterParams: ['status', 'stage', 'user_id', 'priority', 'loan_type', 'contact_entity_id'],
  requiredFields: ['contact_entity_id', 'user_id'],
  allowDelete: true,
});
EOF

cat > src/routes/contact-entities.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'contact_entities',
  filterParams: ['user_id', 'stage', 'source', 'priority', 'industry', 'loan_type', 'lender_id'],
  requiredFields: ['name', 'email', 'user_id'],
  allowDelete: true,
});
EOF

cat > src/routes/lenders.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'lenders',
  filterParams: ['status', 'lender_type', 'user_id'],
  requiredFields: ['name'],
  allowDelete: true,
});
EOF

cat > src/routes/clients.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'clients',
  filterParams: ['status', 'user_id', 'contact_entity_id', 'lead_id'],
  requiredFields: ['user_id', 'contact_entity_id'],
  allowDelete: false,
});
EOF

cat > src/routes/service-providers.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'service_providers',
  filterParams: ['provider_type', 'status', 'user_id'],
  requiredFields: ['name'],
  allowDelete: true,
});
EOF

cat > src/routes/profiles.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'profiles',
  filterParams: ['user_id', 'role', 'is_active'],
  requiredFields: ['user_id'],
  allowDelete: false,
});
EOF

cat > src/routes/messages.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'messages',
  filterParams: ['user_id', 'sender_id', 'recipient_id', 'lead_id', 'is_read', 'message_type'],
  requiredFields: ['user_id'],
  allowDelete: false,
});
EOF

cat > src/routes/tasks.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'tasks',
  filterParams: ['user_id', 'assigned_to', 'lead_id', 'status', 'priority', 'task_type'],
  requiredFields: ['user_id', 'title'],
  allowDelete: true,
});
EOF

cat > src/routes/lead-documents.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'lead_documents',
  filterParams: ['lead_id', 'user_id', 'document_type', 'status', 'category'],
  requiredFields: ['document_name'],
  allowDelete: true,
});
EOF

cat > src/routes/document-templates.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'document_templates',
  filterParams: ['template_type', 'is_active', 'created_by'],
  requiredFields: ['name'],
  allowDelete: true,
});
EOF

cat > src/routes/document-versions.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'document_versions',
  filterParams: ['document_id', 'uploaded_by', 'is_current'],
  requiredFields: ['document_id'],
  allowDelete: false,
});
EOF

cat > src/routes/email-accounts.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'email_accounts',
  filterParams: ['user_id', 'is_active'],
  requiredFields: ['user_id', 'email_address'],
  allowDelete: true,
});
EOF

cat > src/routes/approval-requests.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'approval_requests',
  filterParams: ['status', 'submitted_by', 'record_type', 'process_id'],
  requiredFields: ['submitted_by', 'record_id', 'record_type', 'process_id'],
  allowDelete: false,
});
EOF

cat > src/routes/approval-steps.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'approval_steps',
  filterParams: ['request_id', 'approver_id', 'status'],
  requiredFields: ['request_id', 'step_number', 'approver_id'],
  allowDelete: false,
});
EOF

cat > src/routes/additional-borrowers.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'additional_borrowers',
  filterParams: ['lead_id', 'contact_entity_id', 'is_primary'],
  requiredFields: ['lead_id', 'contact_entity_id'],
  allowDelete: true,
});
EOF

cat > src/routes/cases.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'cases',
  filterParams: ['status', 'priority', 'case_type', 'client_id', 'user_id'],
  requiredFields: ['case_number', 'subject', 'description', 'client_id', 'user_id'],
  allowDelete: false,
});
EOF

cat > src/routes/case-comments.js << 'EOF'
module.exports = require('../crud-factory')({
  table: 'case_comments',
  filterParams: ['case_id', 'user_id', 'comment_type', 'is_internal'],
  requiredFields: ['case_id', 'user_id', 'comment_text'],
  allowDelete: false,
});
EOF

# ══════════════════════════════════════════════════════════════════════════════
# README
# ══════════════════════════════════════════════════════════════════════════════
cat > README.md << 'ENDFILE'
# HBF-API

REST API server for Halo Business Finance CRM ecosystem.

## Architecture

```
HBF-Website → HBF-Portal → HBF-API → PostgreSQL ← HBF-CRM
```

## Endpoints

All routes under `/api/v1/` — protected by `X-API-Key` header.

| Route | Table | Methods |
|-------|-------|---------|
| `/api/v1/leads` | leads | GET, POST, PUT, PATCH, DELETE |
| `/api/v1/contact-entities` | contact_entities | GET, POST, PUT, PATCH, DELETE |
| `/api/v1/lenders` | lenders | GET, POST, PUT, PATCH, DELETE |
| `/api/v1/clients` | clients | GET, POST, PUT, PATCH |
| `/api/v1/service-providers` | service_providers | GET, POST, PUT, PATCH, DELETE |
| `/api/v1/profiles` | profiles | GET, POST, PUT, PATCH |
| `/api/v1/messages` | messages | GET, POST, PUT, PATCH |
| `/api/v1/tasks` | tasks | GET, POST, PUT, PATCH, DELETE |
| `/api/v1/lead-documents` | lead_documents | GET, POST, PUT, PATCH, DELETE |
| `/api/v1/document-templates` | document_templates | GET, POST, PUT, PATCH, DELETE |
| `/api/v1/document-versions` | document_versions | GET, POST, PUT, PATCH |
| `/api/v1/email-accounts` | email_accounts | GET, POST, PUT, PATCH, DELETE |
| `/api/v1/approval-requests` | approval_requests | GET, POST, PUT, PATCH |
| `/api/v1/approval-steps` | approval_steps | GET, POST, PUT, PATCH |
| `/api/v1/additional-borrowers` | additional_borrowers | GET, POST, PUT, PATCH, DELETE |
| `/api/v1/cases` | cases | GET, POST, PUT, PATCH |
| `/api/v1/case-comments` | case_comments | GET, POST, PUT, PATCH |

## Query Parameters

- `?field=value` — filter by any declared filter param
- `?search=term` — full-text search
- `?order_by=column&order_dir=asc|desc` — sorting
- `?limit=100&offset=0` — pagination

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CRM_API_KEY` | Recommended | API key for authentication |
| `PORT` | No | Server port (default: 8080) |
| `DATABASE_SSL` | No | Set to `false` to disable SSL |

## Deploy to IBM Code Engine

```bash
ibmcloud ce application update -n hbf-api --build-source . --strategy dockerfile
```
ENDFILE

# ══════════════════════════════════════════════════════════════════════════════
# Commit and push
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "▶ Files created. Committing..."
git add -A
git commit -m "feat: convert hbf-api to Express REST API server

- Express 4 server with CRUD factory pattern
- 17 REST endpoints for all CRM tables
- API key authentication via X-API-Key header
- CORS configured for all HBF Code Engine apps
- Dockerfile for IBM Code Engine deployment
- Health check at /health"

echo ""
echo "▶ Pushing to GitHub..."
git push origin main

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Done! Now deploy to Code Engine:"
echo ""
echo "  ibmcloud ce application update -n hbf-api \\"
echo "    --build-source . \\"
echo "    --strategy dockerfile \\"
echo "    --env DATABASE_URL='your-postgres-url' \\"
echo "    --env CRM_API_KEY='generate-a-secure-key'"
echo ""
echo "  # Or if using existing env vars:"
echo "  ibmcloud ce application update -n hbf-api \\"
echo "    --build-source . --strategy dockerfile"
echo "═══════════════════════════════════════════════════════"
