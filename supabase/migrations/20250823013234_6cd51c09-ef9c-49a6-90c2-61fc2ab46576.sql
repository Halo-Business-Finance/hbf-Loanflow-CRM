-- Create the missing ensure_ai_bots_active function that the cron job is trying to call
CREATE OR REPLACE FUNCTION public.ensure_ai_bots_active()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Reactivate any inactive bots (unless in maintenance)
  UPDATE ai_security_bots 
  SET status = 'active', 
      updated_at = now(),
      last_activity = now()
  WHERE status = 'inactive' 
    AND (configuration IS NULL OR configuration->>'emergency_shutdown' IS NULL);
  
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
$$;