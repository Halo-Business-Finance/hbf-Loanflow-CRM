-- Create optimized session cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions_optimized()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  cleanup_count integer := 0;
  old_logs_count integer := 0;
BEGIN
  -- Clean up expired active sessions
  DELETE FROM public.active_sessions 
  WHERE expires_at < now() OR last_activity < (now() - interval '24 hours');
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  -- Clean up old security events (keep last 30 days)
  DELETE FROM public.security_events 
  WHERE created_at < (now() - interval '30 days');
  
  GET DIAGNOSTICS old_logs_count = ROW_COUNT;
  
  -- Clean up old audit logs (keep last 90 days)
  DELETE FROM public.audit_logs 
  WHERE created_at < (now() - interval '90 days');
  
  RETURN jsonb_build_object(
    'sessions_cleaned', cleanup_count,
    'old_events_cleaned', old_logs_count,
    'cleanup_time', now()
  );
END;
$function$;

-- Create threat detection function
CREATE OR REPLACE FUNCTION public.detect_security_threats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  threats_detected integer := 0;
  suspicious_ips inet[];
  failed_attempts_count integer;
BEGIN
  -- Detect multiple failed login attempts from same IP
  INSERT INTO public.security_notifications (
    notification_type, title, message, severity, metadata
  )
  SELECT 
    'multiple_failed_logins',
    'Multiple Failed Login Attempts',
    'Detected ' || count(*) || ' failed login attempts from IP: ' || ip_address::text,
    'high',
    jsonb_build_object('ip_address', ip_address, 'attempt_count', count(*))
  FROM public.security_events 
  WHERE event_type = 'auth_failure' 
    AND created_at > (now() - interval '1 hour')
  GROUP BY ip_address 
  HAVING count(*) >= 5;
  
  GET DIAGNOSTICS threats_detected = ROW_COUNT;
  
  -- Detect suspicious IP changes for same user
  INSERT INTO public.security_notifications (
    user_id, notification_type, title, message, severity, metadata
  )
  SELECT DISTINCT
    se1.user_id,
    'suspicious_ip_change',
    'Suspicious IP Change Detected',
    'User account accessed from multiple IP addresses within short timeframe',
    'medium',
    jsonb_build_object(
      'ip_addresses', array_agg(DISTINCT se1.ip_address),
      'time_window', '1 hour'
    )
  FROM public.security_events se1
  WHERE se1.created_at > (now() - interval '1 hour')
    AND se1.user_id IS NOT NULL
    AND se1.ip_address IS NOT NULL
  GROUP BY se1.user_id
  HAVING count(DISTINCT se1.ip_address) > 2;
  
  RETURN jsonb_build_object(
    'threats_detected', threats_detected,
    'scan_time', now(),
    'status', 'completed'
  );
END;
$function$;

-- Create system performance monitoring function
CREATE OR REPLACE FUNCTION public.monitor_system_performance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  active_sessions_count integer;
  recent_events_count integer;
  db_size text;
BEGIN
  -- Count active sessions
  SELECT count(*) INTO active_sessions_count
  FROM public.active_sessions
  WHERE is_active = true AND expires_at > now();
  
  -- Count recent security events (last hour)
  SELECT count(*) INTO recent_events_count
  FROM public.security_events
  WHERE created_at > (now() - interval '1 hour');
  
  -- Log system metrics
  INSERT INTO public.security_events (
    event_type, severity, details
  ) VALUES (
    'system_performance_check',
    'low',
    jsonb_build_object(
      'active_sessions', active_sessions_count,
      'recent_events', recent_events_count,
      'check_time', now()
    )
  );
  
  RETURN jsonb_build_object(
    'active_sessions', active_sessions_count,
    'recent_events', recent_events_count,
    'check_time', now(),
    'status', 'healthy'
  );
END;
$function$;