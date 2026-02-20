const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'document_versions',
  filterParams: ['document_id', 'uploaded_by'],
  requiredFields: ['document_id'],
  allowDelete: false,
});
