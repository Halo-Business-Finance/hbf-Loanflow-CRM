const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'approval_requests',
  filterParams: ['status', 'submitted_by', 'record_type'],
  requiredFields: ['submitted_by', 'record_id', 'record_type'],
  allowDelete: false,
});
