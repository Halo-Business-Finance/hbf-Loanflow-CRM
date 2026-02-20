const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'email_accounts',
  filterParams: ['user_id', 'is_active'],
  requiredFields: ['user_id', 'email_address'],
  allowDelete: true,
});
