-- Add scheduled_for column to notifications table for reminders
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS scheduled_for timestamp with time zone;

-- Add an index for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON notifications(scheduled_for);

-- Add an index for user_id and scheduled_for combination
CREATE INDEX IF NOT EXISTS idx_notifications_user_scheduled ON notifications(user_id, scheduled_for) WHERE scheduled_for IS NOT NULL;