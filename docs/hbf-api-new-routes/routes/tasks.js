const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'tasks',
  filterParams: ['user_id', 'assigned_to', 'status', 'priority', 'lead_id'],
  requiredFields: ['user_id', 'title'],
  allowDelete: true,
});
