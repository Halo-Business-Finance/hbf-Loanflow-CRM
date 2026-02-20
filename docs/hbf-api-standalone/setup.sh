#!/bin/bash
# ══════════════════════════════════════════════════════════════
# HBF-API Setup Script — run from Cloud Shell home directory
# Creates a standalone Express API project and deploys to Code Engine
# ══════════════════════════════════════════════════════════════
set -e

echo "═══ Creating hbf-api-standalone project ═══"

# Clean up any previous attempt
rm -rf ~/hbf-api-standalone
mkdir -p ~/hbf-api-standalone/src/routes

# ── package.json ──────────────────────────────────────────────
cat > ~/hbf-api-standalone/package.json << 'PKGJSON'
{
  "name": "hbf-api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node src/server.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "pg": "^8.13.0",
    "uuid": "^10.0.0",
    "cors": "^2.8.5"
  }
}
PKGJSON

# ── db.js ─────────────────────────────────────────────────────
cat > ~/hbf-api-standalone/src/db.js << 'DBJS'
const { Pool } = require('pg');
let pool;
function initDb() {
  const cs = process.env.DATABASE_URL;
  if (!cs) { console.warn('DATABASE_URL not set'); return Promise.resolve(); }
  pool = new Pool({ connectionString: cs, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }, max: 10, idleTimeoutMillis: 30000 });
  return pool.query('SELECT 1').then(() => console.log('PostgreSQL connected'));
}
async function query(sql, params = []) {
  if (!pool) throw new Error('Database not initialized');
  const r = await pool.query(sql, params); return r.rows;
}
function uuidv4() { return require('uuid').v4(); }
module.exports = { initDb, query, uuidv4 };
DBJS

# ── crud-factory.js ───────────────────────────────────────────
cat > ~/hbf-api-standalone/src/crud-factory.js << 'CRUDFACTORY'
const express = require('express');
const { query, uuidv4 } = require('./db');
function crudRoutes({ table, filterParams = [], requiredFields = [], allowDelete = false }) {
  const router = express.Router();
  router.get('/', async (req, res) => {
    try {
      let sql = `SELECT * FROM "${table}" WHERE 1=1`; const params = []; let idx = 1;
      for (const fp of filterParams) { if (req.query[fp] !== undefined) { sql += ` AND "${fp}" = $${idx++}`; params.push(req.query[fp]); } }
      const oc = req.query.order_by || 'created_at'; const od = req.query.order_dir === 'asc' ? 'ASC' : 'DESC';
      sql += /^[a-z_]+$/i.test(oc) ? ` ORDER BY "${oc}" ${od}` : ` ORDER BY "created_at" DESC`;
      sql += ` LIMIT ${Math.min(parseInt(req.query.limit)||100,500)} OFFSET ${parseInt(req.query.offset)||0}`;
      res.json(await query(sql, params));
    } catch (e) { console.error(`[${table}] GET error:`, e.message); res.status(500).json({error:{message:'Internal error'}}); }
  });
  router.get('/:id', async (req, res) => {
    try { const r = await query(`SELECT * FROM "${table}" WHERE id=$1`,[req.params.id]); r.length ? res.json(r[0]) : res.status(404).json({error:{message:'Not found'}}); }
    catch (e) { res.status(500).json({error:{message:'Internal error'}}); }
  });
  router.post('/', async (req, res) => {
    try {
      for (const f of requiredFields) { if (!req.body[f] && req.body[f] !== 0 && req.body[f] !== false) return res.status(400).json({error:{message:`Missing: ${f}`}}); }
      const id = req.body.id || uuidv4(); const now = new Date().toISOString();
      const rec = {...req.body, id, created_at: now, updated_at: now};
      const cols = Object.keys(rec).filter(k => rec[k] !== undefined);
      const vals = cols.map(k => typeof rec[k]==='object' && rec[k]!==null ? JSON.stringify(rec[k]) : rec[k]);
      await query(`INSERT INTO "${table}" (${cols.map(c=>`"${c}"`).join(',')}) VALUES (${cols.map((_,i)=>`$${i+1}`).join(',')})`, vals);
      const rows = await query(`SELECT * FROM "${table}" WHERE id=$1`,[id]); res.status(201).json(rows[0]||rec);
    } catch (e) { if(e.code==='23505') return res.status(409).json({error:{message:'Duplicate'}}); res.status(500).json({error:{message:'Internal error'}}); }
  });
  router.put('/:id', async (req, res) => {
    try {
      const ex = await query(`SELECT id FROM "${table}" WHERE id=$1`,[req.params.id]); if(!ex.length) return res.status(404).json({error:{message:'Not found'}});
      const u = {...req.body, updated_at: new Date().toISOString()}; delete u.id; delete u.created_at;
      const k = Object.keys(u); if(!k.length) return res.status(400).json({error:{message:'Empty update'}});
      const v = k.map(x => typeof u[x]==='object' && u[x]!==null ? JSON.stringify(u[x]) : u[x]); v.push(req.params.id);
      await query(`UPDATE "${table}" SET ${k.map((x,i)=>`"${x}"=$${i+1}`).join(',')} WHERE id=$${k.length+1}`, v);
      const rows = await query(`SELECT * FROM "${table}" WHERE id=$1`,[req.params.id]); res.json(rows[0]);
    } catch (e) { res.status(500).json({error:{message:'Internal error'}}); }
  });
  if (allowDelete) {
    router.delete('/:id', async (req, res) => {
      try { const ex = await query(`SELECT id FROM "${table}" WHERE id=$1`,[req.params.id]); if(!ex.length) return res.status(404).json({error:{message:'Not found'}}); await query(`DELETE FROM "${table}" WHERE id=$1`,[req.params.id]); res.json({success:true}); }
      catch (e) { res.status(500).json({error:{message:'Internal error'}}); }
    });
  }
  return router;
}
module.exports = crudRoutes;
CRUDFACTORY

# ── server.js ─────────────────────────────────────────────────
cat > ~/hbf-api-standalone/src/server.js << 'SERVERJS'
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const app = express();
const PORT = process.env.PORT || 8080;
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api/v1', (req, res, next) => {
  const k = req.headers['x-api-key'], e = process.env.CRM_API_KEY;
  if (e && k !== e) return res.status(401).json({error:{message:'Unauthorized'}});
  next();
});
const apiRouter = express.Router();
apiRouter.use('/leads', require('./routes/leads'));
apiRouter.use('/contact-entities', require('./routes/contact-entities'));
apiRouter.use('/lenders', require('./routes/lenders'));
apiRouter.use('/clients', require('./routes/clients'));
apiRouter.use('/service-providers', require('./routes/service-providers'));
apiRouter.use('/profiles', require('./routes/profiles'));
apiRouter.use('/messages', require('./routes/messages'));
apiRouter.use('/tasks', require('./routes/tasks'));
apiRouter.use('/lead-documents', require('./routes/lead-documents'));
apiRouter.use('/document-templates', require('./routes/document-templates'));
apiRouter.use('/document-versions', require('./routes/document-versions'));
apiRouter.use('/email-accounts', require('./routes/email-accounts'));
apiRouter.use('/approval-requests', require('./routes/approval-requests'));
apiRouter.use('/approval-steps', require('./routes/approval-steps'));
app.use('/api/v1', apiRouter);
app.get('/health', (req, res) => res.json({status:'ok',timestamp:new Date().toISOString()}));
initDb().then(() => app.listen(PORT, '0.0.0.0', () => console.log(`hbf-api on :${PORT}`))).catch(e => { console.error(e); process.exit(1); });
SERVERJS

# ── Route files ───────────────────────────────────────────────
cat > ~/hbf-api-standalone/src/routes/leads.js << 'EOF'
module.exports = require('../crud-factory')({ table: 'leads', filterParams: ['status','stage','user_id','priority','loan_type'], requiredFields: ['contact_entity_id','user_id'], allowDelete: true });
EOF

cat > ~/hbf-api-standalone/src/routes/contact-entities.js << 'EOF'
module.exports = require('../crud-factory')({ table: 'contact_entities', filterParams: ['user_id','stage','source','priority','industry','loan_type'], requiredFields: ['name','email','user_id'], allowDelete: true });
EOF

cat > ~/hbf-api-standalone/src/routes/lenders.js << 'EOF'
module.exports = require('../crud-factory')({ table: 'lenders', filterParams: ['status','lender_type','user_id'], requiredFields: ['name'], allowDelete: true });
EOF

cat > ~/hbf-api-standalone/src/routes/clients.js << 'EOF'
module.exports = require('../crud-factory')({ table: 'clients', filterParams: ['status','user_id'], requiredFields: ['user_id','contact_entity_id'], allowDelete: false });
EOF

cat > ~/hbf-api-standalone/src/routes/service-providers.js << 'EOF'
module.exports = require('../crud-factory')({ table: 'service_providers', filterParams: ['provider_type','status','user_id'], requiredFields: ['name'], allowDelete: true });
EOF

cat > ~/hbf-api-standalone/src/routes/profiles.js << 'EOF'
module.exports = require('../crud-factory')({ table: 'profiles', filterParams: ['user_id','role','is_active'], requiredFields: ['user_id'], allowDelete: false });
EOF

cat > ~/hbf-api-standalone/src/routes/messages.js << 'EOF'
module.exports = require('../crud-factory')({ table: 'messages', filterParams: ['user_id','sender_id','recipient_id','lead_id','is_read','message_type'], requiredFields: ['user_id'], allowDelete: false });
EOF

cat > ~/hbf-api-standalone/src/routes/tasks.js << 'EOF'
module.exports = require('../crud-factory')({ table: 'tasks', filterParams: ['user_id','assigned_to','lead_id','status','priority','task_type'], requiredFields: ['user_id','title'], allowDelete: true });
EOF

cat > ~/hbf-api-standalone/src/routes/lead-documents.js << 'EOF'
module.exports = require('../crud-factory')({ table: 'lead_documents', filterParams: ['lead_id','user_id','document_type','status'], requiredFields: ['document_name'], allowDelete: true });
EOF

cat > ~/hbf-api-standalone/src/routes/document-templates.js << 'EOF'
module.exports = require('../crud-factory')({ table: 'document_templates', filterParams: ['template_type','is_active','user_id'], requiredFields: ['name'], allowDelete: true });
EOF

cat > ~/hbf-api-standalone/src/routes/document-versions.js << 'EOF'
module.exports = require('../crud-factory')({ table: 'document_versions', filterParams: ['document_id','uploaded_by'], requiredFields: ['document_id'], allowDelete: false });
EOF

cat > ~/hbf-api-standalone/src/routes/email-accounts.js << 'EOF'
module.exports = require('../crud-factory')({ table: 'email_accounts', filterParams: ['user_id','is_active'], requiredFields: ['user_id','email_address'], allowDelete: true });
EOF

cat > ~/hbf-api-standalone/src/routes/approval-requests.js << 'EOF'
module.exports = require('../crud-factory')({ table: 'approval_requests', filterParams: ['status','submitted_by','record_type'], requiredFields: ['submitted_by','record_id','record_type'], allowDelete: false });
EOF

cat > ~/hbf-api-standalone/src/routes/approval-steps.js << 'EOF'
module.exports = require('../crud-factory')({ table: 'approval_steps', filterParams: ['request_id','approver_id','status'], requiredFields: ['request_id','step_number','approver_id'], allowDelete: false });
EOF

echo ""
echo "═══ Project created at ~/hbf-api-standalone ═══"
echo ""
echo "Next steps:"
echo "  cd ~/hbf-api-standalone"
echo "  npm install"
echo "  # Then deploy:"
echo "  ibmcloud ce application update -n hbf-api --build-source ."
echo ""
echo "Don't forget to set env vars:"
echo "  ibmcloud ce application update -n hbf-api \\"
echo "    --env DATABASE_URL='your-postgres-connection-string' \\"
echo "    --env CRM_API_KEY='your-generated-api-key'"
