const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'service_providers',
  filterParams: ['status', 'provider_type', 'user_id'],
  requiredFields: ['name'],
  allowDelete: true,
});
