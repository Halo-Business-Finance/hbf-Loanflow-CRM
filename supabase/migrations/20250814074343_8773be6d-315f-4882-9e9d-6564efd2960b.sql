-- Enhanced Session Security Improvements
-- Add role-based session timeouts and concurrent session limits

-- Create session timeout configuration by role
CREATE TABLE IF NOT EXISTS public.role_session_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.user_role NOT NULL UNIQUE,
  timeout_minutes INTEGER NOT NULL DEFAULT 480, -- 8 hours default
  max_concurrent_sessions INTEGER NOT NULL DEFAULT 3,
  require_2fa BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default configurations
INSERT INTO public.role_session_config (role, timeout_minutes, max_concurrent_sessions, require_2fa) VALUES
('super_admin', 120, 2, true),    -- 2 hours, max 2 sessions, 2FA required
('admin', 240, 3, true),          -- 4 hours, max 3 sessions, 2FA required
('manager', 360, 5, false),       -- 6 hours, max 5 sessions
('agent', 480, 3, false),         -- 8 hours, max 3 sessions
('closer', 480, 3, false),        -- 8 hours, max 3 sessions
('funder', 480, 3, false),        -- 8 hours, max 3 sessions
('processor', 480, 3, false),     -- 8 hours, max 3 sessions
('underwriter', 480, 3, false);   -- 8 hours, max 3 sessions

-- Add session fingerprinting to active_sessions
ALTER TABLE public.active_sessions 
ADD COLUMN IF NOT EXISTS browser_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS screen_resolution TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT,
ADD COLUMN IF NOT EXISTS language TEXT,
ADD COLUMN IF NOT EXISTS session_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS concurrent_session_count INTEGER DEFAULT 1;

-- Create real-time security alerts table
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_user_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'resolved', 'false_positive')),
  assigned_to UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create automated response rules
CREATE TABLE IF NOT EXISTS public.automated_response_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL UNIQUE,
  trigger_conditions JSONB NOT NULL,
  response_actions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default automated response rules
INSERT INTO public.automated_response_rules (rule_name, trigger_conditions, response_actions, created_by) VALUES
('Multiple Failed Logins', 
 '{"event_type": "failed_login", "count": 5, "timeframe_minutes": 15}',
 '{"actions": ["lock_account", "send_alert", "log_security_event"], "severity": "high"}',
 NULL),
('Suspicious IP Login',
 '{"event_type": "login", "conditions": ["new_ip", "different_country"]}',
 '{"actions": ["require_2fa", "send_alert", "log_security_event"], "severity": "medium"}',
 NULL),
('High Risk Data Access',
 '{"event_type": "contact_data_access", "risk_score": {"gte": 70}}',
 '{"actions": ["send_alert", "log_security_event", "require_supervisor_approval"], "severity": "high"}',
 NULL);

-- Create compliance audit trail
CREATE TABLE IF NOT EXISTS public.compliance_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_type TEXT NOT NULL,
  regulation_type TEXT NOT NULL, -- SOX, PCI-DSS, GDPR, etc.
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  compliance_status TEXT DEFAULT 'compliant' CHECK (compliance_status IN ('compliant', 'violation', 'warning')),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.role_session_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automated_response_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_audit_trail ENABLE ROW LEVEL SECURITY;

-- RLS Policies for role_session_config
CREATE POLICY "Admins can manage role session config" ON public.role_session_config
  FOR ALL USING (public.has_role('admin', auth.uid()) OR public.has_role('super_admin', auth.uid()));

CREATE POLICY "Users can view their role config" ON public.role_session_config
  FOR SELECT USING (role = public.get_user_role(auth.uid()));

-- RLS Policies for security_alerts  
CREATE POLICY "Security admins can manage alerts" ON public.security_alerts
  FOR ALL USING (public.has_role('admin', auth.uid()) OR public.has_role('super_admin', auth.uid()));

CREATE POLICY "Users can view their own alerts" ON public.security_alerts
  FOR SELECT USING (affected_user_id = auth.uid());

-- RLS Policies for automated_response_rules
CREATE POLICY "Admins can manage response rules" ON public.automated_response_rules
  FOR ALL USING (public.has_role('admin', auth.uid()) OR public.has_role('super_admin', auth.uid()));

-- RLS Policies for compliance_audit_trail
CREATE POLICY "Compliance auditors can view all" ON public.compliance_audit_trail
  FOR SELECT USING (public.has_role('admin', auth.uid()) OR public.has_role('super_admin', auth.uid()));

CREATE POLICY "Users can view their own compliance records" ON public.compliance_audit_trail
  FOR SELECT USING (user_id = auth.uid());

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
          INSERT INTO public.security_alerts (alert_type, severity, title, description, affected_user_id, metadata)
          VALUES ('high_risk_session', 'medium', 'High Risk Session Activity',
                  'Session validation failed due to high risk score: ' || risk_score,
                  p_user_id, jsonb_build_object('risk_score', risk_score, 'session_id', session_record.id));
        END IF;
      ELSE
        reason := 'Concurrent session limit exceeded';
        INSERT INTO public.security_alerts (alert_type, severity, title, description, affected_user_id)
        VALUES ('concurrent_session_limit', 'medium', 'Concurrent Session Limit Exceeded',
                'User exceeded maximum concurrent sessions for their role', p_user_id);
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
    -- Check if conditions are met (simplified logic)
    IF rule_record.trigger_conditions ? 'count' THEN
      -- Check event count within timeframe
      CONTINUE; -- Simplified for now
    END IF;
    
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