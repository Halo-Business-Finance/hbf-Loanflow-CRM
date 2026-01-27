-- Fix security warnings by setting search_path for functions

-- Fix ensure_ai_bots_active function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Fix emergency_shutdown_ai_bots function
CREATE OR REPLACE FUNCTION emergency_shutdown_ai_bots(p_reason TEXT DEFAULT 'Emergency shutdown triggered')
RETURNS JSONB AS $$
BEGIN
  -- Deactivate all bots
  UPDATE ai_security_bots 
  SET status = 'inactive', 
      updated_at = now(),
      configuration = configuration || jsonb_build_object('emergency_shutdown', true, 'shutdown_reason', p_reason);
  
  -- Log emergency shutdown
  INSERT INTO emergency_events (threat_type, severity, trigger_source, event_data, auto_shutdown)
  VALUES ('ai_bot_shutdown', 'critical', 'system', 
          jsonb_build_object('reason', p_reason, 'timestamp', now()), true);
  
  RETURN jsonb_build_object('success', true, 'message', 'All AI security bots have been shut down');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Fix update_ai_bot_activity function  
CREATE OR REPLACE FUNCTION update_ai_bot_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.last_activity = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';