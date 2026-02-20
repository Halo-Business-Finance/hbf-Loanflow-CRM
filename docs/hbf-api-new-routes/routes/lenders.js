const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'lenders',
  filterParams: ['status', 'lender_type', 'user_id'],
  requiredFields: ['name'],
  allowDelete: true,
});
