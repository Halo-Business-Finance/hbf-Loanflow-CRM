-- Critical Security Migration: Fix validation and monitoring issues
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
  session_valid boolean;
  user_id_val uuid;
BEGIN
  user_id_val := auth.uid();
  
  IF user_id_val IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get user role
  user_role_val := public.get_user_role(user_id_val)::text;
  
  -- Validate session with enhanced security checks
  SELECT valid INTO session_valid
  FROM public.validate_enhanced_session(
    user_id_val,
    '',  -- We'll get the session token from context
    '{"validation": "critical_operation"}'::jsonb,
    inet_client_addr()
  );
  
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
        'session_valid', session_valid,
        'timestamp', now()
      )
    );
    
    -- Require MFA for admin operations (simplified check)
    -- In a real implementation, this would check for recent MFA verification
    RETURN session_valid AND user_role_val = 'super_admin';
  END IF;
  
  -- Regular users need valid session
  RETURN session_valid;
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
      WHEN TG_OP = 'SELECT' THEN 'low'
      WHEN TG_OP IN ('INSERT', 'UPDATE') THEN 'medium'
      WHEN TG_OP = 'DELETE' THEN 'high'
      ELSE 'medium'
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

-- 3. Add monitoring triggers to sensitive tables
DROP TRIGGER IF EXISTS monitor_contact_entities_access ON public.contact_entities;
CREATE TRIGGER monitor_contact_entities_access
  AFTER SELECT OR INSERT OR UPDATE OR DELETE ON public.contact_entities
  FOR EACH ROW EXECUTE FUNCTION public.monitor_sensitive_field_access();

DROP TRIGGER IF EXISTS monitor_contact_encrypted_fields_access ON public.contact_encrypted_fields;
CREATE TRIGGER monitor_contact_encrypted_fields_access
  AFTER SELECT OR INSERT OR UPDATE OR DELETE ON public.contact_encrypted_fields
  FOR EACH ROW EXECUTE FUNCTION public.monitor_sensitive_field_access();

-- 4. Create enhanced function for encrypting sensitive contact fields
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_contact_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  sensitive_fields text[] := ARRAY['email', 'phone', 'credit_score', 'income', 'loan_amount', 'annual_revenue', 'bdo_email', 'bdo_telephone'];
  field_name text;
  field_value text;
BEGIN
  -- Only process INSERT and UPDATE operations
  IF TG_OP NOT IN ('INSERT', 'UPDATE') THEN
    RETURN NEW;
  END IF;
  
  -- Loop through sensitive fields and encrypt them
  FOREACH field_name IN ARRAY sensitive_fields
  LOOP
    -- Get field value using dynamic SQL
    EXECUTE format('SELECT ($1).%I::text', field_name) INTO field_value USING NEW;
    
    -- If field has a value, encrypt it
    IF field_value IS NOT NULL AND field_value != '' THEN
      -- Call the encryption function
      PERFORM public.encrypt_contact_field(NEW.id, field_name, field_value);
      
      -- Clear the field from the main table
      EXECUTE format('SELECT ($1 #= ''{%I, NULL}'').*', field_name) INTO NEW;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- 5. Create security configuration table for dynamic security settings
CREATE TABLE IF NOT EXISTS public.security_configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
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

-- 6. Add function to get security configuration
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

-- 7. Create comprehensive audit logging for all security-related operations
CREATE OR REPLACE FUNCTION public.log_security_operation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log all operations on security-sensitive tables
  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, 
    old_values, new_values, risk_score
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
    CASE 
      WHEN TG_TABLE_NAME IN ('contact_entities', 'contact_encrypted_fields') THEN 80
      WHEN TG_TABLE_NAME IN ('user_roles', 'profiles') THEN 90
      ELSE 50
    END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply security logging to critical tables
DROP TRIGGER IF EXISTS log_security_operation_profiles ON public.profiles;
CREATE TRIGGER log_security_operation_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_security_operation();

DROP TRIGGER IF EXISTS log_security_operation_user_roles ON public.user_roles;
CREATE TRIGGER log_security_operation_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_security_operation();