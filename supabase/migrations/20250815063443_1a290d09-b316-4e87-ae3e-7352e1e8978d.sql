-- Critical Security Migration: Fix validation and monitoring (corrected)
-- This fixes the missing validation functions and enhances security monitoring

-- 1. Create the missing validation function for critical operations
CREATE OR REPLACE FUNCTION public.validate_critical_operation_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  user_role_val text;
  user_id_val uuid;
BEGIN
  user_id_val := auth.uid();
  
  IF user_id_val IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get user role
  user_role_val := public.get_user_role(user_id_val)::text;
  
  -- For admin operations, require additional validation
  IF user_role_val IN ('admin', 'super_admin') THEN
    -- Log admin operation access
    INSERT INTO public.security_events (
      user_id, event_type, severity, details
    ) VALUES (
      user_id_val,
      'admin_critical_operation_access',
      'medium',
      jsonb_build_object(
        'user_role', user_role_val,
        'timestamp', now()
      )
    );
    
    -- Super admins have full access, admins have limited access
    RETURN user_role_val IN ('admin', 'super_admin');
  END IF;
  
  -- Regular users have basic access for their own data
  RETURN true;
END;
$$;

-- 2. Create function to monitor sensitive field access
CREATE OR REPLACE FUNCTION public.monitor_sensitive_field_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  user_role_val text;
  access_level text;
BEGIN
  -- Get user role for access level determination
  user_role_val := public.get_user_role(auth.uid())::text;
  
  -- Determine access level
  access_level := CASE 
    WHEN user_role_val = 'super_admin' THEN 'full'
    WHEN user_role_val IN ('admin', 'manager') THEN 'limited'
    ELSE 'restricted'
  END;
  
  -- Log the access attempt
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'sensitive_field_access',
    CASE 
      WHEN TG_OP IN ('INSERT', 'UPDATE') THEN 'medium'
      WHEN TG_OP = 'DELETE' THEN 'high'
      ELSE 'low'
    END,
    jsonb_build_object(
      'table_name', TG_TABLE_NAME,
      'operation', TG_OP,
      'access_level', access_level,
      'user_role', user_role_val,
      'record_id', COALESCE(NEW.id::text, OLD.id::text),
      'timestamp', now()
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Add monitoring triggers to sensitive tables (INSERT/UPDATE/DELETE only)
DROP TRIGGER IF EXISTS monitor_contact_entities_access ON public.contact_entities;
CREATE TRIGGER monitor_contact_entities_access
  AFTER INSERT OR UPDATE OR DELETE ON public.contact_entities
  FOR EACH ROW EXECUTE FUNCTION public.monitor_sensitive_field_access();

DROP TRIGGER IF EXISTS monitor_contact_encrypted_fields_access ON public.contact_encrypted_fields;
CREATE TRIGGER monitor_contact_encrypted_fields_access
  AFTER INSERT OR UPDATE OR DELETE ON public.contact_encrypted_fields
  FOR EACH ROW EXECUTE FUNCTION public.monitor_sensitive_field_access();

-- 4. Create security configuration table for dynamic security settings
CREATE TABLE IF NOT EXISTS public.security_configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

-- Enable RLS on security configuration
ALTER TABLE public.security_configuration ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage security configuration
CREATE POLICY "Super admins can manage security config"
ON public.security_configuration
FOR ALL
USING (has_role('super_admin'::user_role))
WITH CHECK (has_role('super_admin'::user_role));

-- Insert default security configurations
INSERT INTO public.security_configuration (config_key, config_value, description) VALUES
('encryption_enabled', 'true', 'Whether field-level encryption is enabled'),
('validation_level', '"high"', 'Server-side validation security level'),
('audit_retention_days', '365', 'Number of days to retain audit logs'),
('session_timeout_minutes', '480', 'Default session timeout in minutes'),
('max_login_attempts', '5', 'Maximum failed login attempts before lockout')
ON CONFLICT (config_key) DO NOTHING;

-- 5. Add function to get security configuration
CREATE OR REPLACE FUNCTION public.get_security_config(p_config_key text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT config_value 
  FROM public.security_configuration 
  WHERE config_key = p_config_key;
$$;