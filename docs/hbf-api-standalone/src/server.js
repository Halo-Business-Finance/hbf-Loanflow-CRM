const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── API Key Auth ─────────────────────────────────────────────
app.use('/api/v1', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expected = process.env.CRM_API_KEY;
  if (expected && apiKey !== expected) {
    return res.status(401).json({ error: { message: 'Invalid API key', code: 'UNAUTHORIZED' } });
  }
  next();
});

// ── Routes ───────────────────────────────────────────────────
const apiRouter = express.Router();
const crudRoutes = require('./crud-factory');

// ── CRUD Routes ──────────────────────────────────────────────
apiRouter.use('/leads',              require('./routes/leads'));
apiRouter.use('/contact-entities',   require('./routes/contact-entities'));
// Also mount as /borrowers for the route-map alias
apiRouter.use('/borrowers',          require('./routes/contact-entities'));
apiRouter.use('/lenders',            require('./routes/lenders'));
apiRouter.use('/clients',            require('./routes/clients'));
apiRouter.use('/service-providers',  require('./routes/service-providers'));
apiRouter.use('/profiles',           require('./routes/profiles'));
apiRouter.use('/messages',           require('./routes/messages'));
apiRouter.use('/tasks',              require('./routes/tasks'));
apiRouter.use('/lead-documents',     require('./routes/lead-documents'));
apiRouter.use('/document-templates', require('./routes/document-templates'));
apiRouter.use('/document-versions',  require('./routes/document-versions'));
apiRouter.use('/email-accounts',     require('./routes/email-accounts'));
apiRouter.use('/approval-requests',  require('./routes/approval-requests'));
apiRouter.use('/approval-steps',     require('./routes/approval-steps'));

// ── Additional CRUD Routes (from route-map) ──────────────────
apiRouter.use('/sla-policies',       crudRoutes({ table: 'sla_policies', filterParams: ['entity_type', 'is_active'], requiredFields: ['name'], allowDelete: true }));
apiRouter.use('/sla-tracking',       crudRoutes({ table: 'sla_tracking', filterParams: ['policy_id', 'entity_type', 'entity_id', 'status', 'assigned_to'], requiredFields: ['policy_id'], allowDelete: false }));
apiRouter.use('/lender-contacts',    crudRoutes({ table: 'lender_contacts', filterParams: ['lender_id', 'email', 'is_active'], requiredFields: ['lender_id'], allowDelete: true }));
apiRouter.use('/ai-lead-scores',     crudRoutes({ table: 'ai_lead_scores', filterParams: ['lead_id', 'score'], requiredFields: ['lead_id'], allowDelete: false }));
apiRouter.use('/partner-organizations', crudRoutes({ table: 'partner_organizations', filterParams: ['status', 'partner_type'], requiredFields: ['name'], allowDelete: true }));
apiRouter.use('/partner-submissions',   crudRoutes({ table: 'partner_submissions', filterParams: ['organization_id', 'status', 'submitted_by'], requiredFields: ['organization_id'], allowDelete: false }));
apiRouter.use('/security-events',    crudRoutes({ table: 'security_events', filterParams: ['event_type', 'severity', 'user_id'], requiredFields: ['event_type'], allowDelete: false }));
apiRouter.use('/security-pattern-alerts', crudRoutes({ table: 'security_pattern_alerts', filterParams: ['alert_type', 'severity', 'status'], requiredFields: [], allowDelete: false }));
apiRouter.use('/active-sessions',    crudRoutes({ table: 'active_sessions', filterParams: ['user_id', 'is_active', 'session_token'], requiredFields: ['user_id', 'session_token'], allowDelete: true }));
apiRouter.use('/user-roles',         crudRoutes({ table: 'user_roles', filterParams: ['user_id', 'role', 'is_active'], requiredFields: ['user_id', 'role'], allowDelete: true }));
apiRouter.use('/user-messages',      crudRoutes({ table: 'user_messages', filterParams: ['sender_id', 'recipient_id', 'is_read'], requiredFields: ['sender_id', 'recipient_id'], allowDelete: true }));
apiRouter.use('/emergency-events',   crudRoutes({ table: 'emergency_events', filterParams: ['severity', 'threat_type', 'trigger_source'], requiredFields: [], allowDelete: false }));
apiRouter.use('/emergency-shutdown', crudRoutes({ table: 'emergency_shutdown', filterParams: ['is_active', 'shutdown_level'], requiredFields: [], allowDelete: false }));
apiRouter.use('/report-execution-logs', crudRoutes({ table: 'report_execution_logs', filterParams: ['report_id', 'user_id', 'status'], requiredFields: [], allowDelete: false }));
apiRouter.use('/business-entities',  crudRoutes({ table: 'business_entities', filterParams: ['entity_type', 'parent_entity_id', 'is_active'], requiredFields: ['name'], allowDelete: true }));
apiRouter.use('/entity-memberships', crudRoutes({ table: 'entity_memberships', filterParams: ['entity_id', 'user_id', 'role'], requiredFields: ['entity_id', 'user_id'], allowDelete: true }));
apiRouter.use('/pipeline-entries',   crudRoutes({ table: 'pipeline_entries', filterParams: ['lead_id', 'stage', 'status'], requiredFields: ['lead_id'], allowDelete: true }));
apiRouter.use('/notifications',      crudRoutes({ table: 'notifications', filterParams: ['user_id', 'is_read', 'type'], requiredFields: [], allowDelete: true }));
apiRouter.use('/audit-logs',         crudRoutes({ table: 'audit_logs', filterParams: ['action', 'table_name', 'user_id'], requiredFields: ['action'], allowDelete: false }));

// ── RPC Routes ───────────────────────────────────────────────
const rolesRpc     = require('./routes/rpc/roles');
const securityRpc  = require('./routes/rpc/security');
const sessionsRpc  = require('./routes/rpc/sessions');
const documentsRpc = require('./routes/rpc/documents');
const contactsRpc  = require('./routes/rpc/contacts');
const mfaRpc       = require('./routes/rpc/mfa');
const reportsRpc   = require('./routes/rpc/reports');

// Auth & Roles
apiRouter.use('/roles',       rolesRpc);
apiRouter.use('/auth',        rolesRpc);  // is-email-verified, check-mfa, mark-mfa live under /auth

// Security
apiRouter.use('/security',    securityRpc);
apiRouter.use('/audit',       securityRpc);  // /audit/create

// Sessions
apiRouter.use('/sessions',    sessionsRpc);

// Documents
apiRouter.use('/documents',   documentsRpc);

// Contacts & Data
apiRouter.use('/data',        contactsRpc);

// MFA
apiRouter.use('/mfa',         mfaRpc);

// Pipeline, Reports, Compliance, Email
apiRouter.use('/leads',       reportsRpc);   // /leads/accessible
apiRouter.use('/pipeline',    reportsRpc);   // /pipeline/analytics
apiRouter.use('/reports',     reportsRpc);   // /reports/dashboard-metrics
apiRouter.use('/compliance',  reportsRpc);   // /compliance/generate-report
apiRouter.use('/email',       reportsRpc);   // /email/get-tokens-secure, store-tokens-secure

// ── Generic RPC fallback ─────────────────────────────────────
apiRouter.post('/rpc/:fn_name', async (req, res) => {
  try {
    const { fn_name } = req.params;
    const params = req.body || {};
    const { query: dbQuery } = require('./db');

    // Build SELECT fn_name(param1 := $1, ...) call
    const keys = Object.keys(params);
    if (keys.length === 0) {
      const rows = await dbQuery(`SELECT ${fn_name}() as result`);
      return res.json(rows[0]?.result ?? null);
    }

    const placeholders = keys.map((k, i) => `${k} := $${i + 1}`).join(', ');
    const values = keys.map(k => typeof params[k] === 'object' ? JSON.stringify(params[k]) : params[k]);
    const rows = await dbQuery(`SELECT ${fn_name}(${placeholders}) as result`, values);
    res.json(rows[0]?.result ?? null);
  } catch (err) {
    console.error(`[rpc] ${req.params.fn_name} error:`, err.message);
    res.status(500).json({ error: { message: err.message, code: 'RPC_ERROR' } });
  }
});

app.use('/api/v1', apiRouter);

// ── Health check ─────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Start ────────────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`hbf-api listening on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
