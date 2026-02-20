const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'lead_documents',
  filterParams: ['lead_id', 'user_id', 'status', 'document_type'],
  requiredFields: ['document_name'],
  allowDelete: true,
});
