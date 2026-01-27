-- CRITICAL SECURITY FIXES - Phase 1: Database Access Control

-- Fix 1: Secure mfa_settings table (currently missing RLS policies)
CREATE TABLE IF NOT EXISTS public.mfa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret_key TEXT NOT NULL,
  backup_codes TEXT[],
  is_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.mfa_settings ENABLE ROW LEVEL SECURITY;

-- MFA settings must be restricted to account owners only
CREATE POLICY "Users can only access their own MFA settings"
ON public.mfa_settings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fix 2: Secure ringcentral_accounts table (missing RLS policies)
CREATE TABLE IF NOT EXISTS public.ringcentral_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  account_id TEXT,
  extension_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.ringcentral_accounts ENABLE ROW LEVEL SECURITY;

-- RingCentral accounts must be restricted to account owners only
CREATE POLICY "Users can only access their own RingCentral accounts"
ON public.ringcentral_accounts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fix 3: Enhance session security with encrypted tokens
-- Add encryption trigger for active_sessions if not exists
CREATE OR REPLACE FUNCTION public.encrypt_active_session_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_token IS NOT NULL THEN
    -- Encrypt only if not already encrypted (decryption returns NULL on failure)
    IF public.decrypt_token(NEW.session_token) IS NULL THEN
      NEW.session_token := public.encrypt_token(NEW.session_token);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Create trigger for session token encryption
DROP TRIGGER IF EXISTS encrypt_session_token_trigger ON public.active_sessions;
CREATE TRIGGER encrypt_session_token_trigger
  BEFORE INSERT OR UPDATE ON public.active_sessions
  FOR EACH ROW EXECUTE FUNCTION public.encrypt_active_session_token();

-- Fix 4: Enhanced session validation with IP tracking
CREATE OR REPLACE FUNCTION public.validate_session_with_security_checks(
  p_user_id UUID,
  p_session_token TEXT,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  session_record RECORD;
  config_record RECORD;
  is_valid BOOLEAN := false;
  reason TEXT := 'Session validation failed';
  risk_score INTEGER := 0;
  security_flags JSONB := '[]'::JSONB;
BEGIN
  -- Get session config
  SELECT * INTO config_record FROM public.session_config LIMIT 1;
  
  -- Get active session; support plaintext or encrypted storage of token
  SELECT * INTO session_record
  FROM public.active_sessions 
  WHERE user_id = p_user_id 
    AND is_active = true
    AND (
      session_token = p_session_token
      OR public.decrypt_token(session_token) = p_session_token
    )
  LIMIT 1;
  
  IF FOUND THEN
    -- Check if session has expired
    IF session_record.expires_at > now() THEN
      -- Check if last activity is within timeout
      IF session_record.last_activity > (now() - INTERVAL '1 minute' * config_record.session_timeout_minutes) THEN
        -- Additional security checks
        IF p_ip_address IS NOT NULL AND session_record.ip_address IS NOT NULL 
           AND session_record.ip_address != p_ip_address THEN
          risk_score := risk_score + 30;
          security_flags := security_flags || '"ip_change"'::JSONB;
        END IF;
        
        IF p_user_agent IS NOT NULL AND session_record.user_agent IS NOT NULL 
           AND session_record.user_agent != p_user_agent THEN
          risk_score := risk_score + 20;
          security_flags := security_flags || '"user_agent_change"'::JSONB;
        END IF;
        
        IF session_record.last_activity < (now() - INTERVAL '1 hour') THEN
          risk_score := risk_score + 10;
          security_flags := security_flags || '"long_inactive"'::JSONB;
        END IF;
        
        IF risk_score < 50 THEN
          is_valid := true;
          reason := 'Session valid';
          
          -- Update last activity and security info
          UPDATE public.active_sessions 
          SET 
            last_activity = now(),
            ip_address = COALESCE(p_ip_address, ip_address),
            user_agent = COALESCE(p_user_agent, user_agent)
          WHERE id = session_record.id;
        ELSE
          reason := 'Session flagged for suspicious activity';
          INSERT INTO public.security_events (user_id, event_type, severity, details, ip_address, user_agent)
          VALUES (p_user_id, 'suspicious_session_activity', 'medium', 
                  jsonb_build_object('risk_score', risk_score, 'flags', security_flags),
                  p_ip_address, p_user_agent);
        END IF;
      ELSE
        reason := 'Session timeout due to inactivity';
        UPDATE public.active_sessions SET is_active = false WHERE id = session_record.id;
      END IF;
    ELSE
      reason := 'Session expired';
      UPDATE public.active_sessions SET is_active = false WHERE id = session_record.id;
    END IF;
  ELSE
    reason := 'Session not found or inactive';
  END IF;
  
  INSERT INTO public.audit_logs (user_id, action, table_name, new_values)
  VALUES (p_user_id, 'session_validation', 'active_sessions',
          jsonb_build_object('valid', is_valid, 'reason', reason, 'risk_score', risk_score));
  
  RETURN jsonb_build_object(
    'valid', is_valid,
    'reason', reason,
    'requires_reauth', NOT is_valid,
    'risk_score', risk_score,
    'security_flags', security_flags
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Fix 5: Enhanced input validation and sanitization
CREATE OR REPLACE FUNCTION public.validate_and_sanitize_input_enhanced(
  p_input TEXT,
  p_field_type TEXT DEFAULT 'text',
  p_max_length INTEGER DEFAULT 255,
  p_allow_html BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
  sanitized_input TEXT;
  is_valid BOOLEAN := true;
  errors TEXT[] := '{}';
  xss_patterns TEXT[] := ARRAY[
    '<script[^>]*>.*?</script>',
    'javascript:',
    'vbscript:',
    'onload\s*=',
    'onerror\s*=',
    'onclick\s*=',
    'onmouseover\s*=',
    'onfocus\s*=',
    'onblur\s*=',
    'onkeyup\s*=',
    'onchange\s*=',
    '<iframe[^>]*>',
    '<object[^>]*>',
    '<embed[^>]*>',
    '<link[^>]*>',
    '<meta[^>]*>',
    'expression\s*\(',
    'url\s*\(',
    'import\s*\('
  ];
  pattern TEXT;
BEGIN
  -- Initial sanitization
  sanitized_input := trim(p_input);
  
  -- Length validation
  IF length(sanitized_input) > p_max_length THEN
    is_valid := false;
    errors := array_append(errors, 'Input exceeds maximum length of ' || p_max_length);
  END IF;
  
  -- XSS detection and prevention
  IF NOT p_allow_html THEN
    FOREACH pattern IN ARRAY xss_patterns
    LOOP
      IF sanitized_input ~* pattern THEN
        is_valid := false;
        errors := array_append(errors, 'Potentially malicious content detected');
        -- Log security event
        INSERT INTO public.security_events (event_type, severity, details)
        VALUES ('xss_attempt', 'high', jsonb_build_object('pattern', pattern, 'input', left(p_input, 100)));
        EXIT; -- Stop checking once malicious content is found
      END IF;
    END LOOP;
    
    -- Remove HTML tags if no malicious content found but HTML not allowed
    IF is_valid THEN
      sanitized_input := regexp_replace(sanitized_input, '<[^>]*>', '', 'g');
    END IF;
  END IF;
  
  -- Field type specific validation
  CASE p_field_type
    WHEN 'email' THEN
      IF NOT sanitized_input ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        is_valid := false;
        errors := array_append(errors, 'Invalid email format');
      END IF;
    WHEN 'phone' THEN
      -- Remove all non-digits for phone validation
      sanitized_input := regexp_replace(sanitized_input, '[^0-9+\-\(\)\s]', '', 'g');
      -- Basic phone validation
      IF length(regexp_replace(sanitized_input, '[^0-9]', '', 'g')) < 10 OR 
         length(regexp_replace(sanitized_input, '[^0-9]', '', 'g')) > 15 THEN
        is_valid := false;
        errors := array_append(errors, 'Phone number must be 10-15 digits');
      END IF;
    WHEN 'numeric' THEN
      IF NOT sanitized_input ~ '^[0-9]+(\.[0-9]+)?$' THEN
        is_valid := false;
        errors := array_append(errors, 'Must be a valid number');
      END IF;
    WHEN 'url' THEN
      IF NOT sanitized_input ~ '^https?://[^\s/$.?#].[^\s]*$' THEN
        is_valid := false;
        errors := array_append(errors, 'Must be a valid URL');
      END IF;
  END CASE;
  
  -- SQL injection prevention (additional layer)
  IF sanitized_input ~* '(union\s+select|drop\s+table|delete\s+from|insert\s+into|update\s+.+set|exec\s*\(|execute\s*\()' THEN
    is_valid := false;
    errors := array_append(errors, 'Invalid characters detected');
    -- Log potential SQL injection attempt
    INSERT INTO public.security_events (event_type, severity, details)
    VALUES ('sql_injection_attempt', 'critical', jsonb_build_object('input', left(p_input, 100)));
  END IF;
  
  RETURN jsonb_build_object(
    'valid', is_valid,
    'sanitized', CASE WHEN is_valid THEN sanitized_input ELSE NULL END,
    'errors', errors
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Log security implementation completion
INSERT INTO public.audit_logs (action, table_name, new_values)
VALUES ('critical_security_fixes_implemented', 'security_implementation',
        jsonb_build_object(
          'fixes_applied', ARRAY[
            'MFA settings secured with user ownership RLS',
            'RingCentral accounts secured with user ownership RLS', 
            'Session tokens encrypted at rest',
            'Enhanced session validation with IP tracking',
            'Advanced input validation with XSS/injection prevention'
          ],
          'security_level', 'critical',
          'timestamp', now()
        ));