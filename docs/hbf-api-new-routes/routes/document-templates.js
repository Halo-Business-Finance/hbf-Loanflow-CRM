const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'document_templates',
  filterParams: ['template_type', 'is_active', 'user_id'],
  requiredFields: ['name'],
  allowDelete: true,
});
