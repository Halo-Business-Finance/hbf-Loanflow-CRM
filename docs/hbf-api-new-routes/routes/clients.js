const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'clients',
  filterParams: ['status', 'user_id'],
  requiredFields: ['user_id'],
  allowDelete: false,
});
