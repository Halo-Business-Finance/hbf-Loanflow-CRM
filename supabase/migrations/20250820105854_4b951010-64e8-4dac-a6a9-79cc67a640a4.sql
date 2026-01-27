-- Advanced Security Enhancements

-- Create table for tracking security patterns and anomalies
CREATE TABLE IF NOT EXISTS public.security_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  pattern_data JSONB NOT NULL DEFAULT '{}',
  severity TEXT NOT NULL DEFAULT 'medium',
  confidence_score NUMERIC(3,2) NOT NULL DEFAULT 0.5,
  first_detected TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_detected TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_mitigated BOOLEAN NOT NULL DEFAULT false,
  mitigation_actions JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on security_patterns
ALTER TABLE public.security_patterns ENABLE ROW LEVEL SECURITY;

-- Create policies for security_patterns
CREATE POLICY "Admins can manage security patterns" ON public.security_patterns
FOR ALL USING (has_role('admin'::user_role));

CREATE POLICY "System can insert security patterns" ON public.security_patterns
FOR INSERT WITH CHECK (true);

-- Create table for IP reputation tracking
CREATE TABLE IF NOT EXISTS public.ip_reputation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET NOT NULL UNIQUE,
  reputation_score INTEGER NOT NULL DEFAULT 50,
  threat_categories TEXT[] DEFAULT '{}',
  country_code TEXT,
  is_vpn BOOLEAN DEFAULT false,
  is_tor BOOLEAN DEFAULT false,
  is_proxy BOOLEAN DEFAULT false,
  risk_level TEXT NOT NULL DEFAULT 'low',
  first_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  reputation_sources JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on ip_reputation
ALTER TABLE public.ip_reputation ENABLE ROW LEVEL SECURITY;

-- Create policies for ip_reputation
CREATE POLICY "Admins can manage IP reputation" ON public.ip_reputation
FOR ALL USING (has_role('admin'::user_role));

CREATE POLICY "System can update IP reputation" ON public.ip_reputation
FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update IP reputation records" ON public.ip_reputation
FOR UPDATE USING (true);

-- Create table for behavioral anomaly detection
CREATE TABLE IF NOT EXISTS public.user_behavior_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pattern_type TEXT NOT NULL,
  baseline_metrics JSONB NOT NULL DEFAULT '{}',
  current_metrics JSONB NOT NULL DEFAULT '{}',
  anomaly_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  deviation_factors JSONB DEFAULT '[]',
  is_anomalous BOOLEAN NOT NULL DEFAULT false,
  learning_phase BOOLEAN NOT NULL DEFAULT true,
  sample_size INTEGER NOT NULL DEFAULT 0,
  last_analysis TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_behavior_patterns
ALTER TABLE public.user_behavior_patterns ENABLE ROW LEVEL SECURITY;

-- Create policies for user_behavior_patterns
CREATE POLICY "Users can view their behavior patterns" ON public.user_behavior_patterns
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage behavior patterns" ON public.user_behavior_patterns
FOR ALL USING (has_role('admin'::user_role));

CREATE POLICY "System can manage behavior patterns" ON public.user_behavior_patterns
FOR ALL USING (true);

-- Create table for security policy documentation
CREATE TABLE IF NOT EXISTS public.security_policy_docs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_name TEXT NOT NULL UNIQUE,
  policy_type TEXT NOT NULL,
  description TEXT NOT NULL,
  rationale TEXT,
  implementation_details JSONB DEFAULT '{}',
  compliance_requirements TEXT[],
  last_reviewed TIMESTAMP WITH TIME ZONE,
  next_review_due TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on security_policy_docs
ALTER TABLE public.security_policy_docs ENABLE ROW LEVEL SECURITY;

-- Create policies for security_policy_docs
CREATE POLICY "Admins can manage security policy docs" ON public.security_policy_docs
FOR ALL USING (has_role('admin'::user_role));

-- Create function for advanced anomaly detection
CREATE OR REPLACE FUNCTION public.detect_behavioral_anomaly(
  p_user_id UUID,
  p_current_session_data JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  baseline_pattern RECORD;
  anomaly_score NUMERIC := 0;
  deviation_factors TEXT[] := '{}';
  is_anomalous BOOLEAN := false;
BEGIN
  -- Get existing behavioral pattern for user
  SELECT * INTO baseline_pattern
  FROM public.user_behavior_patterns
  WHERE user_id = p_user_id
  AND pattern_type = 'session_behavior'
  ORDER BY updated_at DESC
  LIMIT 1;
  
  IF baseline_pattern.id IS NOT NULL THEN
    -- Compare current behavior with baseline
    
    -- Check login time anomaly
    IF (p_current_session_data->>'login_hour')::INTEGER NOT BETWEEN
       (baseline_pattern.baseline_metrics->>'typical_login_start')::INTEGER AND
       (baseline_pattern.baseline_metrics->>'typical_login_end')::INTEGER THEN
      anomaly_score := anomaly_score + 25;
      deviation_factors := array_append(deviation_factors, 'unusual_login_time');
    END IF;
    
    -- Check session duration anomaly
    IF (p_current_session_data->>'session_duration_minutes')::INTEGER > 
       (baseline_pattern.baseline_metrics->>'avg_session_duration')::INTEGER * 3 THEN
      anomaly_score := anomaly_score + 20;
      deviation_factors := array_append(deviation_factors, 'extended_session');
    END IF;
    
    -- Check geographic anomaly
    IF (p_current_session_data->>'country') != 
       (baseline_pattern.baseline_metrics->>'typical_country') THEN
      anomaly_score := anomaly_score + 40;
      deviation_factors := array_append(deviation_factors, 'geographic_anomaly');
    END IF;
    
    -- Check device fingerprint anomaly
    IF (p_current_session_data->>'device_fingerprint') NOT LIKE 
       (baseline_pattern.baseline_metrics->>'device_pattern') THEN
      anomaly_score := anomaly_score + 30;
      deviation_factors := array_append(deviation_factors, 'device_anomaly');
    END IF;
    
    -- Determine if behavior is anomalous
    is_anomalous := anomaly_score > 50;
    
    -- Update pattern with new data
    UPDATE public.user_behavior_patterns
    SET 
      current_metrics = p_current_session_data,
      anomaly_score = detect_behavioral_anomaly.anomaly_score,
      deviation_factors = deviation_factors::JSONB,
      is_anomalous = detect_behavioral_anomaly.is_anomalous,
      last_analysis = now(),
      updated_at = now()
    WHERE id = baseline_pattern.id;
  ELSE
    -- Create initial baseline pattern
    INSERT INTO public.user_behavior_patterns (
      user_id, pattern_type, baseline_metrics, current_metrics,
      anomaly_score, learning_phase, sample_size
    ) VALUES (
      p_user_id, 'session_behavior', p_current_session_data, p_current_session_data,
      0, true, 1
    );
  END IF;
  
  -- Log anomaly if detected
  IF is_anomalous THEN
    INSERT INTO public.security_events (
      user_id, event_type, severity, details
    ) VALUES (
      p_user_id,
      'behavioral_anomaly',
      CASE WHEN anomaly_score > 80 THEN 'high' ELSE 'medium' END,
      jsonb_build_object(
        'anomaly_score', anomaly_score,
        'deviation_factors', deviation_factors,
        'current_session', p_current_session_data
      )
    );
  END IF;
  
  RETURN jsonb_build_object(
    'is_anomalous', is_anomalous,
    'anomaly_score', anomaly_score,
    'deviation_factors', deviation_factors,
    'requires_additional_verification', anomaly_score > 70
  );
END;
$$;

-- Create function for IP reputation checking
CREATE OR REPLACE FUNCTION public.check_ip_reputation(p_ip_address INET)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  ip_record RECORD;
  risk_score INTEGER := 0;
  risk_factors TEXT[] := '{}';
  reputation_result JSONB;
BEGIN
  -- Get existing IP reputation record
  SELECT * INTO ip_record
  FROM public.ip_reputation
  WHERE ip_address = p_ip_address;
  
  IF ip_record.id IS NOT NULL THEN
    -- Use existing reputation data
    risk_score := 100 - ip_record.reputation_score;
    
    IF ip_record.is_vpn THEN
      risk_factors := array_append(risk_factors, 'vpn_detected');
      risk_score := risk_score + 10;
    END IF;
    
    IF ip_record.is_tor THEN
      risk_factors := array_append(risk_factors, 'tor_detected');
      risk_score := risk_score + 30;
    END IF;
    
    IF array_length(ip_record.threat_categories, 1) > 0 THEN
      risk_factors := array_append(risk_factors, 'known_threats');
      risk_score := risk_score + 25;
    END IF;
    
    -- Update last seen
    UPDATE public.ip_reputation
    SET 
      last_seen = now(),
      request_count = request_count + 1,
      updated_at = now()
    WHERE ip_address = p_ip_address;
  ELSE
    -- Create new IP reputation record with neutral score
    INSERT INTO public.ip_reputation (
      ip_address, reputation_score, risk_level
    ) VALUES (
      p_ip_address, 50, 'unknown'
    );
    
    risk_score := 25; -- Unknown IPs get moderate risk
    risk_factors := array_append(risk_factors, 'unknown_ip');
  END IF;
  
  -- Determine risk level
  reputation_result := jsonb_build_object(
    'risk_score', LEAST(risk_score, 100),
    'risk_level', CASE 
      WHEN risk_score >= 80 THEN 'critical'
      WHEN risk_score >= 60 THEN 'high'
      WHEN risk_score >= 30 THEN 'medium'
      ELSE 'low'
    END,
    'risk_factors', risk_factors,
    'reputation_score', COALESCE(ip_record.reputation_score, 50),
    'is_known_threat', array_length(COALESCE(ip_record.threat_categories, '{}'), 1) > 0
  );
  
  -- Log high-risk IP access
  IF risk_score >= 60 THEN
    INSERT INTO public.security_events (
      event_type, severity, details, ip_address
    ) VALUES (
      'high_risk_ip_access',
      CASE WHEN risk_score >= 80 THEN 'critical' ELSE 'high' END,
      reputation_result,
      p_ip_address
    );
  END IF;
  
  RETURN reputation_result;
END;
$$;

-- Create function for security pattern detection
CREATE OR REPLACE FUNCTION public.detect_security_pattern(
  p_pattern_type TEXT,
  p_event_data JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_pattern RECORD;
  pattern_confidence NUMERIC;
BEGIN
  -- Check for existing pattern
  SELECT * INTO existing_pattern
  FROM public.security_patterns
  WHERE pattern_type = p_pattern_type
  AND is_active = true
  ORDER BY last_detected DESC
  LIMIT 1;
  
  IF existing_pattern.id IS NOT NULL THEN
    -- Update existing pattern
    UPDATE public.security_patterns
    SET 
      last_detected = now(),
      occurrence_count = occurrence_count + 1,
      pattern_data = pattern_data || p_event_data,
      confidence_score = LEAST(confidence_score + 0.1, 1.0),
      updated_at = now()
    WHERE id = existing_pattern.id;
  ELSE
    -- Create new pattern
    INSERT INTO public.security_patterns (
      pattern_type, pattern_data, confidence_score
    ) VALUES (
      p_pattern_type, p_event_data, 0.5
    );
  END IF;
  
  -- Check if pattern should trigger auto-mitigation
  SELECT confidence_score INTO pattern_confidence
  FROM public.security_patterns
  WHERE pattern_type = p_pattern_type
  AND is_active = true
  ORDER BY last_detected DESC
  LIMIT 1;
  
  IF pattern_confidence >= 0.8 AND p_pattern_type IN ('brute_force', 'credential_stuffing', 'sql_injection') THEN
    -- Trigger auto-mitigation (implement specific logic as needed)
    INSERT INTO public.security_events (
      event_type, severity, details
    ) VALUES (
      'auto_mitigation_triggered',
      'high',
      jsonb_build_object(
        'pattern_type', p_pattern_type,
        'confidence_score', pattern_confidence,
        'action', 'rate_limit_increased'
      )
    );
  END IF;
END;
$$;

-- Create triggers for automatic pattern detection
CREATE OR REPLACE FUNCTION public.auto_detect_patterns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Detect failed login patterns
  IF NEW.event_type = 'failed_login' THEN
    PERFORM public.detect_security_pattern('failed_login_pattern', 
      jsonb_build_object(
        'ip_address', NEW.ip_address,
        'user_agent', NEW.user_agent,
        'timestamp', NEW.created_at
      )
    );
  END IF;
  
  -- Detect suspicious session patterns
  IF NEW.event_type IN ('session_hijacking', 'session_ip_change') THEN
    PERFORM public.detect_security_pattern('session_anomaly_pattern',
      NEW.details || jsonb_build_object('event_type', NEW.event_type)
    );
  END IF;
  
  -- Detect data access patterns
  IF NEW.event_type LIKE '%_data_access%' THEN
    PERFORM public.detect_security_pattern('data_access_pattern',
      NEW.details || jsonb_build_object('event_type', NEW.event_type)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on security_events for pattern detection
DROP TRIGGER IF EXISTS auto_pattern_detection ON public.security_events;
CREATE TRIGGER auto_pattern_detection
  AFTER INSERT ON public.security_events
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_detect_patterns();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_security_patterns_type_active 
  ON public.security_patterns(pattern_type, is_active);

CREATE INDEX IF NOT EXISTS idx_ip_reputation_address 
  ON public.ip_reputation(ip_address);

CREATE INDEX IF NOT EXISTS idx_user_behavior_patterns_user_type 
  ON public.user_behavior_patterns(user_id, pattern_type);

-- Insert initial security policy documentation
INSERT INTO public.security_policy_docs (policy_name, policy_type, description, rationale, created_by)
VALUES 
  ('Row Level Security', 'access_control', 'Comprehensive RLS policies for all sensitive tables', 'Ensures users can only access data they own or have explicit permission to view', auth.uid()),
  ('Session Security', 'authentication', 'Enhanced session validation and monitoring', 'Detects and prevents session hijacking and unauthorized access', auth.uid()),
  ('Input Validation', 'data_protection', 'Server-side input validation and sanitization', 'Prevents XSS, SQL injection, and other input-based attacks', auth.uid()),
  ('Encryption Standards', 'data_protection', 'Field-level encryption for sensitive data', 'Protects PII and financial data at rest and in transit', auth.uid()),
  ('Audit Logging', 'compliance', 'Comprehensive audit trail for all security events', 'Maintains compliance and enables forensic analysis', auth.uid())
ON CONFLICT (policy_name) DO NOTHING;

-- Update timestamps trigger for new tables
CREATE TRIGGER update_security_patterns_updated_at
  BEFORE UPDATE ON public.security_patterns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ip_reputation_updated_at
  BEFORE UPDATE ON public.ip_reputation
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_behavior_patterns_updated_at
  BEFORE UPDATE ON public.user_behavior_patterns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_security_policy_docs_updated_at
  BEFORE UPDATE ON public.security_policy_docs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();