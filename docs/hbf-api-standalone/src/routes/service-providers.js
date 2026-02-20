const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'service_providers',
  filterParams: ['provider_type', 'status', 'user_id'],
  requiredFields: ['name'],
  allowDelete: true,
});
