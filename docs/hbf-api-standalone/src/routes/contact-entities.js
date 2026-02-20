const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'contact_entities',
  filterParams: ['user_id', 'stage', 'source', 'priority', 'industry', 'loan_type'],
  requiredFields: ['name', 'email', 'user_id'],
  allowDelete: true,
});
