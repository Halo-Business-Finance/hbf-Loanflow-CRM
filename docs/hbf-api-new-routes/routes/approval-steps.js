const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'approval_steps',
  filterParams: ['request_id', 'approver_id', 'status'],
  requiredFields: ['request_id', 'step_number', 'approver_id'],
  allowDelete: false,
});
