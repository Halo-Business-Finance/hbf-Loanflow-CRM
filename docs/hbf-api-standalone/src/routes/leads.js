const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'leads',
  filterParams: ['status', 'stage', 'user_id', 'priority', 'loan_type'],
  requiredFields: ['contact_entity_id', 'user_id'],
  allowDelete: true,
});
