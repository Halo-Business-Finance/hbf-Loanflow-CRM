const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'profiles',
  filterParams: ['user_id', 'role', 'is_active'],
  requiredFields: ['user_id'],
  allowDelete: false,
});
