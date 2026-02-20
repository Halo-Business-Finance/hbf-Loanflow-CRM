const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'lead_documents',
  filterParams: ['lead_id', 'user_id', 'document_type', 'status'],
  requiredFields: ['document_name'],
  allowDelete: true,
});
