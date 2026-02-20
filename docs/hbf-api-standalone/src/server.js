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

const leadsRoutes             = require('./routes/leads');
const contactEntitiesRoutes   = require('./routes/contact-entities');
const lendersRoutes           = require('./routes/lenders');
const clientsRoutes           = require('./routes/clients');
const serviceProvidersRoutes  = require('./routes/service-providers');
const profilesRoutes          = require('./routes/profiles');
const messagesRoutes          = require('./routes/messages');
const tasksRoutes             = require('./routes/tasks');
const leadDocumentsRoutes     = require('./routes/lead-documents');
const documentTemplatesRoutes = require('./routes/document-templates');
const documentVersionsRoutes  = require('./routes/document-versions');
const emailAccountsRoutes     = require('./routes/email-accounts');
const approvalRequestsRoutes  = require('./routes/approval-requests');
const approvalStepsRoutes     = require('./routes/approval-steps');

apiRouter.use('/leads',              leadsRoutes);
apiRouter.use('/contact-entities',   contactEntitiesRoutes);
apiRouter.use('/lenders',            lendersRoutes);
apiRouter.use('/clients',            clientsRoutes);
apiRouter.use('/service-providers',  serviceProvidersRoutes);
apiRouter.use('/profiles',           profilesRoutes);
apiRouter.use('/messages',           messagesRoutes);
apiRouter.use('/tasks',              tasksRoutes);
apiRouter.use('/lead-documents',     leadDocumentsRoutes);
apiRouter.use('/document-templates', documentTemplatesRoutes);
apiRouter.use('/document-versions',  documentVersionsRoutes);
apiRouter.use('/email-accounts',     emailAccountsRoutes);
apiRouter.use('/approval-requests',  approvalRequestsRoutes);
apiRouter.use('/approval-steps',     approvalStepsRoutes);

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
