-- Fix Session Security Vulnerabilities 
-- This migration implements strict session protection to prevent hijacking attacks

-- Drop overly permissive system policies that bypass security
DROP POLICY IF EXISTS "System can manage secure sessions" ON public.secure_sessions;
DROP POLICY IF EXISTS "System can manage sessions" ON public.secure_sessions;
DROP POLICY IF EXISTS "System can create sessions" ON public.active_sessions;

-- Create secure session management functions with strict validation
CREATE OR REPLACE FUNCTION public.create_secure_session(
  p_user_id uuid,
  p_session_token text,
  p_device_fingerprint text,
  p_ip_address inet,
  p_user_agent text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  session_id uuid;
  existing_sessions_count integer;
  max_sessions integer := 5;
BEGIN
  -- Validate that only system or the user can create their own session
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot create session for another user';
  END IF;
  
  -- Check for session limit
  SELECT COUNT(*) INTO existing_sessions_count
  FROM public.active_sessions
  WHERE user_id = p_user_id AND is_active = true;
  
  IF existing_sessions_count >= max_sessions THEN
    -- Deactivate oldest session
    UPDATE public.active_sessions
    SET is_active = false
    WHERE user_id = p_user_id
    AND id = (
      SELECT id FROM public.active_sessions
      WHERE user_id = p_user_id AND is_active = true
      ORDER BY last_activity ASC
      LIMIT 1
    );
  END IF;
  
  -- Create new session with encrypted token
  INSERT INTO public.active_sessions (
    user_id, session_token, device_fingerprint, ip_address, user_agent, expires_at
  ) VALUES (
    p_user_id,
    public.encrypt_token(p_session_token),
    p_device_fingerprint,
    p_ip_address,
    p_user_agent,
    now() + interval '8 hours'
  ) RETURNING id INTO session_id;
  
  -- Log session creation
  INSERT INTO public.security_events (
    user_id, event_type, severity, details, ip_address, user_agent
  ) VALUES (
    p_user_id,
    'session_created',
    'medium',
    jsonb_build_object(
      'session_id', session_id,
      'device_fingerprint', p_device_fingerprint,
      'creation_method', 'secure_function'
    ),
    p_ip_address,
    p_user_agent
  );
  
  RETURN session_id;
END;
$$;

-- Create secure session validation function
CREATE OR REPLACE FUNCTION public.validate_session_security(
  p_user_id uuid,
  p_session_token text,
  p_ip_address inet,
  p_user_agent text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  session_record RECORD;
  is_valid boolean := false;
  risk_factors text[] := '{}';
  risk_score integer := 0;
BEGIN
  -- Find active session with decrypted token comparison
  SELECT * INTO session_record
  FROM public.active_sessions
  WHERE user_id = p_user_id
    AND is_active = true
    AND expires_at > now()
    AND public.decrypt_token(session_token) = p_session_token
  LIMIT 1;
  
  IF FOUND THEN
    -- Check for suspicious activity
    IF session_record.ip_address != p_ip_address THEN
      risk_factors := array_append(risk_factors, 'ip_change');
      risk_score := risk_score + 30;
    END IF;
    
    IF session_record.user_agent != p_user_agent THEN
      risk_factors := array_append(risk_factors, 'user_agent_change');
      risk_score := risk_score + 20;
    END IF;
    
    IF session_record.last_activity < (now() - interval '1 hour') THEN
      risk_factors := array_append(risk_factors, 'inactive_session');
      risk_score := risk_score + 10;
    END IF;
    
    -- Determine if session is valid based on risk score
    is_valid := risk_score < 50;
    
    IF is_valid THEN
      -- Update session activity
      UPDATE public.active_sessions
      SET 
        last_activity = now(),
        ip_address = p_ip_address,
        user_agent = p_user_agent
      WHERE id = session_record.id;
    ELSE
      -- Deactivate suspicious session
      UPDATE public.active_sessions
      SET is_active = false
      WHERE id = session_record.id;
      
      -- Log security incident
      INSERT INTO public.security_events (
        user_id, event_type, severity, details, ip_address, user_agent
      ) VALUES (
        p_user_id,
        'suspicious_session_activity',
        'high',
        jsonb_build_object(
          'session_id', session_record.id,
          'risk_score', risk_score,
          'risk_factors', risk_factors
        ),
        p_ip_address,
        p_user_agent
      );
    END IF;
  END IF;
  
  -- Log session validation attempt
  INSERT INTO public.security_events (
    user_id, event_type, severity, details, ip_address, user_agent
  ) VALUES (
    p_user_id,
    'session_validation',
    CASE WHEN is_valid THEN 'low' ELSE 'medium' END,
    jsonb_build_object(
      'valid', is_valid,
      'risk_score', risk_score,
      'risk_factors', risk_factors
    ),
    p_ip_address,
    p_user_agent
  );
  
  RETURN jsonb_build_object(
    'valid', is_valid,
    'risk_score', risk_score,
    'risk_factors', risk_factors,
    'requires_reauth', NOT is_valid
  );
END;
$$;

-- Create secure session cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  cleanup_count integer;
BEGIN
  -- Deactivate expired sessions
  UPDATE public.active_sessions
  SET is_active = false
  WHERE expires_at < now() OR last_activity < (now() - interval '24 hours');
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  -- Clean up old secure session data
  DELETE FROM public.secure_session_data
  WHERE expires_at < now();
  
  -- Clean up old secure sessions
  UPDATE public.secure_sessions
  SET is_active = false
  WHERE expires_at < now() OR last_activity < (now() - interval '24 hours');
  
  -- Log cleanup activity
  INSERT INTO public.security_events (
    event_type, severity, details
  ) VALUES (
    'session_cleanup',
    'low',
    jsonb_build_object(
      'cleaned_sessions', cleanup_count,
      'cleanup_time', now()
    )
  );
  
  RETURN cleanup_count;
END;
$$;

-- Create new secure policies for session tables

-- Active Sessions: Strict user-only access
DROP POLICY IF EXISTS "Users can only access their own sessions" ON public.active_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.active_sessions;
DROP POLICY IF EXISTS "System can create user sessions" ON public.active_sessions;

CREATE POLICY "Users can only view their own active sessions"
  ON public.active_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Secure session creation only"
  ON public.active_sessions
  FOR INSERT
  WITH CHECK (false); -- Block all direct inserts

CREATE POLICY "Users can update their own session activity"
  ON public.active_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can deactivate their own sessions"
  ON public.active_sessions
  FOR UPDATE
  USING (auth.uid() = user_id AND NOT is_active)
  WITH CHECK (auth.uid() = user_id);

-- Secure Sessions: Enhanced protection
DROP POLICY IF EXISTS "System can manage secure sessions" ON public.secure_sessions;
DROP POLICY IF EXISTS "System can manage sessions" ON public.secure_sessions;
DROP POLICY IF EXISTS "Users can only access their own secure sessions" ON public.secure_sessions;
DROP POLICY IF EXISTS "Users can view their own secure sessions" ON public.secure_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.secure_sessions;

CREATE POLICY "Users can only access their own secure sessions"
  ON public.secure_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Secure session creation through functions only"
  ON public.secure_sessions
  FOR INSERT
  WITH CHECK (false); -- Block all direct inserts

CREATE POLICY "Users can update their secure session activity"
  ON public.secure_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User Sessions: Complete lockdown
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;

CREATE POLICY "Users can only view their own user sessions"
  ON public.user_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "No direct user session creation"
  ON public.user_sessions
  FOR INSERT
  WITH CHECK (false); -- Block all direct inserts

CREATE POLICY "Users can update their user session data"
  ON public.user_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin policies for security monitoring (read-only)
CREATE POLICY "Admins can monitor all sessions for security"
  ON public.active_sessions
  FOR SELECT
  USING (has_role('admin'::public.user_role) OR has_role('super_admin'::public.user_role));

CREATE POLICY "Admins can monitor secure sessions for security"
  ON public.secure_sessions
  FOR SELECT
  USING (has_role('admin'::public.user_role) OR has_role('super_admin'::public.user_role));

CREATE POLICY "Admins can monitor user sessions for security"
  ON public.user_sessions
  FOR SELECT
  USING (has_role('admin'::public.user_role) OR has_role('super_admin'::public.user_role));

-- Create session security audit trigger
CREATE OR REPLACE FUNCTION public.audit_session_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log all session table access for security monitoring
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'session_table_access',
    CASE 
      WHEN TG_OP = 'DELETE' THEN 'medium'
      WHEN TG_OP = 'UPDATE' THEN 'low'
      ELSE 'low'
    END,
    jsonb_build_object(
      'table_name', TG_TABLE_NAME,
      'operation', TG_OP,
      'session_id', COALESCE(NEW.id, OLD.id),
      'target_user_id', COALESCE(NEW.user_id, OLD.user_id)
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply audit triggers to all session tables
CREATE TRIGGER audit_active_sessions_access
  AFTER INSERT OR UPDATE OR DELETE ON public.active_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_session_access();

CREATE TRIGGER audit_secure_sessions_access
  AFTER INSERT OR UPDATE OR DELETE ON public.secure_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_session_access();

CREATE TRIGGER audit_user_sessions_access
  AFTER INSERT OR UPDATE OR DELETE ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_session_access();