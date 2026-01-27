-- Security Enhancement Migration: Fix Critical Security Issues (Corrected)

-- 1. Remove conflicting RLS policies on user_roles table
DROP POLICY IF EXISTS "Users can view their role status" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can manage user roles" ON public.user_roles;

-- 2. Create consolidated, secure RLS policies for user_roles
CREATE POLICY "Secure user roles access" ON public.user_roles
FOR SELECT 
USING (
  -- Users can view their own role
  (auth.uid() = user_id) OR 
  -- Admins can view all roles
  (has_role('admin'::user_role) OR has_role('super_admin'::user_role))
);

CREATE POLICY "Secure user roles management" ON public.user_roles
FOR ALL
USING (has_role('super_admin'::user_role))
WITH CHECK (has_role('super_admin'::user_role));

-- 3. Enhanced session security trigger
CREATE OR REPLACE FUNCTION public.validate_session_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_ip inet;
  risk_score integer := 0;
BEGIN
  -- Get current request IP (safely handle potential null)
  BEGIN
    current_ip := (current_setting('request.headers', true)::jsonb->>'x-forwarded-for')::inet;
  EXCEPTION WHEN OTHERS THEN
    current_ip := NULL;
  END;
  
  -- Check for IP changes in session
  IF NEW.ip_address IS NOT NULL AND OLD.ip_address IS NOT NULL 
     AND NEW.ip_address != OLD.ip_address THEN
    risk_score := risk_score + 30;
    
    -- Log IP change
    INSERT INTO public.security_events (
      user_id, event_type, severity, details, ip_address
    ) VALUES (
      NEW.user_id,
      'session_ip_change',
      'medium',
      jsonb_build_object(
        'old_ip', OLD.ip_address,
        'new_ip', NEW.ip_address,
        'session_id', NEW.id
      ),
      current_ip
    );
  END IF;
  
  -- Update risk factors
  NEW.risk_factors := COALESCE(NEW.risk_factors, '[]'::jsonb) || 
    jsonb_build_object('ip_change_risk', risk_score);
  
  -- Force logout if risk too high
  IF risk_score > 50 THEN
    NEW.is_active := false;
    
    INSERT INTO public.security_events (
      user_id, event_type, severity, details, ip_address
    ) VALUES (
      NEW.user_id,
      'high_risk_session_terminated',
      'high',
      jsonb_build_object('risk_score', risk_score, 'session_id', NEW.id),
      current_ip
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply session security trigger
DROP TRIGGER IF EXISTS validate_session_security_trigger ON public.active_sessions;
CREATE TRIGGER validate_session_security_trigger
  BEFORE UPDATE ON public.active_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_session_security();

-- 4. Enhanced credential access monitoring  
CREATE OR REPLACE FUNCTION public.monitor_credential_table_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  operation_type text := TG_OP;
  table_name text := TG_TABLE_NAME;
  user_role text;
BEGIN
  -- Get user role safely
  BEGIN
    user_role := public.get_user_role()::text;
  EXCEPTION WHEN OTHERS THEN
    user_role := 'unknown';
  END;
  
  -- Always log credential table operations
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'credential_table_operation',
    CASE 
      WHEN operation_type = 'DELETE' THEN 'high'
      WHEN user_role = 'super_admin' THEN 'critical'
      ELSE 'medium'
    END,
    jsonb_build_object(
      'table_name', table_name,
      'operation', operation_type,
      'user_role', user_role,
      'timestamp', now(),
      'record_id', CASE 
        WHEN operation_type = 'DELETE' THEN OLD.id::text
        ELSE COALESCE(NEW.id::text, 'unknown')
      END
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5. Drop and recreate session cleanup function with correct signature
DROP FUNCTION IF EXISTS public.cleanup_expired_sessions();
CREATE FUNCTION public.cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected_count integer;
BEGIN
  -- Deactivate expired sessions and count them
  UPDATE public.active_sessions 
  SET is_active = false
  WHERE expires_at < now() AND is_active = true;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Log cleanup
  INSERT INTO public.security_events (
    event_type, severity, details
  ) VALUES (
    'expired_sessions_cleanup',
    'low',
    jsonb_build_object(
      'cleanup_time', now(),
      'sessions_affected', affected_count
    )
  );
  
  -- Delete old inactive sessions (older than 30 days)
  DELETE FROM public.active_sessions 
  WHERE created_at < (now() - interval '30 days') AND is_active = false;
END;
$$;

-- 6. Enhanced input validation function
CREATE OR REPLACE FUNCTION public.validate_secure_input(
  input_data jsonb,
  field_rules jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  validation_result jsonb := '{"valid": true, "errors": []}'::jsonb;
  field_name text;
  field_value text;
  field_count integer := 0;
BEGIN
  -- Validate each field in input_data
  FOR field_name, field_value IN SELECT * FROM jsonb_each_text(input_data) LOOP
    field_count := field_count + 1;
    
    -- Check for XSS patterns
    IF field_value ~* '<script|javascript:|on\w+\s*=|<iframe|<object|<embed' THEN
      validation_result := jsonb_set(
        validation_result,
        '{valid}',
        'false'::jsonb
      );
      validation_result := jsonb_set(
        validation_result,
        '{errors}',
        (validation_result->'errors') || jsonb_build_array('XSS pattern detected in ' || field_name)
      );
    END IF;
    
    -- Check for SQL injection patterns
    IF field_value ~* '(union|select|insert|update|delete|drop|exec|execute|alter|create)\s+' THEN
      validation_result := jsonb_set(
        validation_result,
        '{valid}',
        'false'::jsonb
      );
      validation_result := jsonb_set(
        validation_result,
        '{errors}',
        (validation_result->'errors') || jsonb_build_array('SQL injection pattern detected in ' || field_name)
      );
    END IF;
    
    -- Check for command injection
    IF field_value ~* '(\||&|;|`|\$\(|<|>|rm\s|wget\s|curl\s)' THEN
      validation_result := jsonb_set(
        validation_result,
        '{valid}',
        'false'::jsonb
      );
      validation_result := jsonb_set(
        validation_result,
        '{errors}',
        (validation_result->'errors') || jsonb_build_array('Command injection pattern detected in ' || field_name)
      );
    END IF;
  END LOOP;
  
  -- Log validation attempt
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'input_validation',
    CASE WHEN (validation_result->>'valid')::boolean THEN 'low' ELSE 'high' END,
    jsonb_build_object(
      'valid', validation_result->>'valid',
      'field_count', field_count,
      'error_count', jsonb_array_length(validation_result->'errors')
    )
  );
  
  RETURN validation_result;
END;
$$;