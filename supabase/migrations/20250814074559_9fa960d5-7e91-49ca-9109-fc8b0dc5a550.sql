-- Enhanced Session Security Final Fix
-- Complete the database setup for enhanced security features

-- Enhanced session validation function with role-based timeouts
CREATE OR REPLACE FUNCTION public.validate_enhanced_session(
  p_user_id UUID,
  p_session_token TEXT,
  p_device_fingerprint JSONB DEFAULT '{}',
  p_ip_address INET DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  session_record RECORD;
  role_config RECORD;
  user_role TEXT;
  is_valid BOOLEAN := false;
  reason TEXT := 'Session validation failed';
  risk_score INTEGER := 0;
  concurrent_count INTEGER;
BEGIN
  -- Get user role
  user_role := public.get_user_role(p_user_id)::text;
  
  -- Get role-specific session configuration
  SELECT * INTO role_config 
  FROM public.role_session_config 
  WHERE role = user_role::public.user_role;
  
  IF NOT FOUND THEN
    -- Use default config if role not found
    SELECT 480 as timeout_minutes, 3 as max_concurrent_sessions, false as require_2fa
    INTO role_config;
  END IF;
  
  -- Get session record
  SELECT * INTO session_record
  FROM public.active_sessions
  WHERE user_id = p_user_id 
    AND (session_token = p_session_token OR public.decrypt_token(session_token) = p_session_token)
    AND is_active = true
  LIMIT 1;
  
  IF FOUND THEN
    -- Check role-based timeout
    IF session_record.last_activity > (now() - INTERVAL '1 minute' * role_config.timeout_minutes) THEN
      -- Check concurrent session limit
      SELECT COUNT(*) INTO concurrent_count
      FROM public.active_sessions
      WHERE user_id = p_user_id AND is_active = true;
      
      IF concurrent_count <= role_config.max_concurrent_sessions THEN
        -- Device fingerprint validation
        IF p_device_fingerprint IS NOT NULL AND session_record.browser_fingerprint IS NOT NULL THEN
          IF (p_device_fingerprint->>'screen_resolution') != session_record.screen_resolution OR
             (p_device_fingerprint->>'timezone') != session_record.timezone THEN
            risk_score := risk_score + 25;
          END IF;
        END IF;
        
        -- IP address validation
        IF p_ip_address IS NOT NULL AND session_record.ip_address IS NOT NULL AND
           session_record.ip_address != p_ip_address THEN
          risk_score := risk_score + 30;
        END IF;
        
        IF risk_score < 40 THEN
          is_valid := true;
          reason := 'Session valid';
          
          -- Update session activity
          UPDATE public.active_sessions
          SET last_activity = now(),
              ip_address = COALESCE(p_ip_address, ip_address)
          WHERE id = session_record.id;
        ELSE
          reason := 'High risk session activity detected';
          -- Create security alert
          INSERT INTO public.security_alerts (alert_type, severity, title, description, metadata)
          VALUES ('high_risk_session', 'medium', 'High Risk Session Activity',
                  'Session validation failed due to high risk score: ' || risk_score,
                  jsonb_build_object('risk_score', risk_score, 'session_id', session_record.id, 'user_id', p_user_id));
        END IF;
      ELSE
        reason := 'Concurrent session limit exceeded';
        INSERT INTO public.security_alerts (alert_type, severity, title, description, metadata)
        VALUES ('concurrent_session_limit', 'medium', 'Concurrent Session Limit Exceeded',
                'User exceeded maximum concurrent sessions for their role', 
                jsonb_build_object('user_id', p_user_id, 'concurrent_count', concurrent_count));
      END IF;
    ELSE
      reason := 'Session timeout based on role configuration';
      UPDATE public.active_sessions SET is_active = false WHERE id = session_record.id;
    END IF;
  ELSE
    reason := 'Session not found or inactive';
  END IF;
  
  -- Log compliance audit
  INSERT INTO public.compliance_audit_trail (audit_type, regulation_type, user_id, action, resource_type, details)
  VALUES ('session_validation', 'SOX', p_user_id, 'session_access_attempt', 'active_sessions',
          jsonb_build_object('valid', is_valid, 'reason', reason, 'risk_score', risk_score));
  
  RETURN jsonb_build_object(
    'valid', is_valid,
    'reason', reason,
    'risk_score', risk_score,
    'requires_2fa', role_config.require_2fa AND risk_score > 20,
    'session_timeout_minutes', role_config.timeout_minutes
  );
END;
$$;

-- Function to process automated security responses
CREATE OR REPLACE FUNCTION public.process_automated_security_response(
  p_event_type TEXT,
  p_event_data JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  rule_record RECORD;
  response_result JSONB := '{"actions_taken": []}'::JSONB;
  action TEXT;
BEGIN
  -- Find matching automated response rules
  FOR rule_record IN 
    SELECT * FROM public.automated_response_rules 
    WHERE is_active = true 
      AND trigger_conditions->>'event_type' = p_event_type
  LOOP
    -- Execute response actions
    FOR action IN SELECT jsonb_array_elements_text(rule_record.response_actions->'actions')
    LOOP
      CASE action
        WHEN 'send_alert' THEN
          INSERT INTO public.security_alerts (alert_type, severity, title, description, metadata)
          VALUES (p_event_type || '_automated', 
                  rule_record.response_actions->>'severity',
                  'Automated Security Response: ' || rule_record.rule_name,
                  'Automated response triggered for: ' || p_event_type,
                  p_event_data);
          
          response_result := jsonb_set(response_result, '{actions_taken}', 
                                     response_result->'actions_taken' || '"alert_created"'::jsonb);
        
        WHEN 'log_security_event' THEN
          INSERT INTO public.security_events (event_type, severity, details)
          VALUES ('automated_response_' || p_event_type, 
                  rule_record.response_actions->>'severity',
                  jsonb_build_object('rule_name', rule_record.rule_name, 'event_data', p_event_data));
          
          response_result := jsonb_set(response_result, '{actions_taken}', 
                                     response_result->'actions_taken' || '"security_event_logged"'::jsonb);
      END CASE;
    END LOOP;
  END LOOP;
  
  RETURN response_result;
END;
$$;

-- Fix RLS policies with correct column references
DROP POLICY IF EXISTS "Users can view their own alerts" ON public.security_alerts;
CREATE POLICY "Users can view their own alerts" ON public.security_alerts
  FOR SELECT USING (metadata->>'user_id' = auth.uid()::text);