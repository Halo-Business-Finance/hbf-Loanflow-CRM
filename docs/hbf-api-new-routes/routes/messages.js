const crudRoutes = require('../crud-factory');
module.exports = crudRoutes({
  table: 'messages',
  filterParams: ['user_id', 'recipient_id', 'lead_id', 'is_read', 'message_type'],
  requiredFields: ['user_id'],
  allowDelete: true,
});
