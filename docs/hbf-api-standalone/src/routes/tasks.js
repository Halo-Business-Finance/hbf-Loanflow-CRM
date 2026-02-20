const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'tasks',
  filterParams: ['user_id', 'assigned_to', 'lead_id', 'status', 'priority', 'task_type'],
  requiredFields: ['user_id', 'title'],
  allowDelete: true,
});
