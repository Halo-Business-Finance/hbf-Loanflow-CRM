-- Create cron jobs for persistent AI security monitoring
-- These jobs will run the AI security bots continuously with high frequency

-- Main AI security scan every 30 seconds for maximum alertness
SELECT cron.schedule(
  'ai-security-scan-high-frequency',
  '*/30 * * * * *', -- Every 30 seconds
  $$
  SELECT
    net.http_post(
        url:='https://gshxxsniwytjgcnthyfq.supabase.co/functions/v1/persistent-ai-security?action=run_scan',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzaHh4c25pd3l0amdjbnRoeWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1ODYzMDYsImV4cCI6MjA2OTE2MjMwNn0.KZGdh-f2Z5DrNJ54lv3loaC8wrWvNfhQF7tqQnzK7iQ"}'::jsonb,
        body:=concat('{"timestamp": "', now(), '", "scan_type": "high_frequency"}')::jsonb
    ) as request_id;
  $$
);

-- Emergency threat detection every 10 seconds for critical threats
SELECT cron.schedule(
  'ai-emergency-threat-scan',
  '*/10 * * * * *', -- Every 10 seconds
  $$
  SELECT
    net.http_post(
        url:='https://gshxxsniwytjgcnthyfq.supabase.co/functions/v1/persistent-ai-security?action=run_scan',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzaHh4c25pd3l0amdjbnRoeWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1ODYzMDYsImV4cCI6MjA2OTE2MjMwNn0.KZGdh-f2Z5DrNJ54lv3loaC8wrWvNfhQF7tqQnzK7iQ"}'::jsonb,
        body:=concat('{"timestamp": "', now(), '", "scan_type": "emergency", "priority": "critical"}')::jsonb
    ) as request_id;
  $$
);

-- Bot health monitoring every minute
SELECT cron.schedule(
  'ai-bot-health-monitor',
  '0 * * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
        url:='https://gshxxsniwytjgcnthyfq.supabase.co/functions/v1/persistent-ai-security?action=status',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzaHh4c25pd3l0amdjbnRoeWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1ODYzMDYsImV4cCI6MjA2OTE2MjMwNn0.KZGdh-f2Z5DrNJ54lv3loaC8wrWvNfhQF7tqQnzK7iQ"}'::jsonb,
        body:=concat('{"timestamp": "', now(), '", "health_check": true}')::jsonb
    ) as request_id;
  $$
);

-- Create function to ensure bots are always active
CREATE OR REPLACE FUNCTION ensure_ai_bots_active()
RETURNS VOID AS $$
BEGIN
  -- Reactivate any inactive bots (unless in maintenance)
  UPDATE ai_security_bots 
  SET status = 'active', 
      updated_at = now(),
      last_activity = now()
  WHERE status = 'inactive' 
    AND configuration->>'emergency_shutdown' IS NULL;
  
  -- Log bot status check
  INSERT INTO ai_bot_activity (bot_id, activity_type, details, status)
  SELECT 
    id,
    'health_check',
    jsonb_build_object(
      'status_checked', status,
      'last_activity', last_activity,
      'health_check_time', now()
    ),
    'completed'
  FROM ai_security_bots;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run bot health check every 5 minutes
SELECT cron.schedule(
  'ai-bot-health-check',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT ensure_ai_bots_active();
  $$
);

-- Create realtime alerts publication
ALTER PUBLICATION supabase_realtime ADD TABLE ai_bot_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_bot_activity;
ALTER PUBLICATION supabase_realtime ADD TABLE security_notifications;

-- Set replica identity for realtime updates
ALTER TABLE ai_bot_alerts REPLICA IDENTITY FULL;
ALTER TABLE ai_bot_activity REPLICA IDENTITY FULL;
ALTER TABLE security_notifications REPLICA IDENTITY FULL;