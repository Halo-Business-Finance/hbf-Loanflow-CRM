/**
 * Add these lines to docs/hbf-api-starter/src/server.js
 *
 * 1. Add to the require block (after existing route imports):
 */

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

/**
 * 2. Add to the apiRouter.use() block (after existing mounts):
 */

// apiRouter.use('/lenders',            lendersRoutes);
// apiRouter.use('/clients',            clientsRoutes);
// apiRouter.use('/service-providers',  serviceProvidersRoutes);
// apiRouter.use('/profiles',           profilesRoutes);
// apiRouter.use('/messages',           messagesRoutes);
// apiRouter.use('/tasks',              tasksRoutes);
// apiRouter.use('/lead-documents',     leadDocumentsRoutes);
// apiRouter.use('/document-templates', documentTemplatesRoutes);
// apiRouter.use('/document-versions',  documentVersionsRoutes);
// apiRouter.use('/email-accounts',     emailAccountsRoutes);
// apiRouter.use('/approval-requests',  approvalRequestsRoutes);
// apiRouter.use('/approval-steps',     approvalStepsRoutes);
