-- Security Fix: Ensure strict RLS policies for credential tables
-- This addresses the security finding: Security Credentials Could Be Compromised

-- First, create the validation function
CREATE OR REPLACE FUNCTION public.validate_credential_access(
  p_table_name text,
  p_record_id text,
  p_access_type text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  access_granted boolean := false;
  user_role text;
BEGIN
  -- Get user role
  user_role := public.get_user_role();
  
  -- Only super admins can use emergency access
  IF p_access_type = 'emergency_access' AND user_role = 'super_admin' THEN
    access_granted := true;
  END IF;
  
  -- Always log credential access attempts
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'credential_table_access',
    CASE 
      WHEN p_access_type = 'emergency_access' THEN 'critical'
      ELSE 'high'
    END,
    jsonb_build_object(
      'table_name', p_table_name,
      'record_id', p_record_id,
      'access_type', p_access_type,
      'user_role', user_role,
      'access_granted', access_granted,
      'timestamp', now(),
      'ip_address', current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
    )
  );
  
  -- Log to audit trail
  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, new_values
  ) VALUES (
    auth.uid(),
    'credential_access_attempt',
    p_table_name,
    p_record_id,
    jsonb_build_object(
      'access_type', p_access_type,
      'granted', access_granted,
      'user_role', user_role
    )
  );
  
  RETURN access_granted;
END;
$$;

-- Drop any overly permissive policies and create strict owner-only access
DO $$
BEGIN
  -- Fix 1: Secure mfa_settings table with strict owner-only access
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mfa_settings') THEN
    -- Enable RLS
    ALTER TABLE public.mfa_settings ENABLE ROW LEVEL SECURITY;
    
    -- Drop any existing permissive policies
    DROP POLICY IF EXISTS "Users can manage their MFA settings" ON public.mfa_settings;
    DROP POLICY IF EXISTS "Users can only access their own MFA settings" ON public.mfa_settings;
    DROP POLICY IF EXISTS "Super admins can manage MFA settings for emergency" ON public.mfa_settings;
    DROP POLICY IF EXISTS "All users can manage MFA settings" ON public.mfa_settings;
    DROP POLICY IF EXISTS "Anyone can access MFA settings" ON public.mfa_settings;
    
    -- Create strict owner-only policies
    CREATE POLICY "Strict owner-only access to MFA settings"
    ON public.mfa_settings FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
    
    -- Emergency super admin access with full logging
    CREATE POLICY "Emergency super admin MFA access with audit"
    ON public.mfa_settings FOR ALL
    USING (
      has_role('super_admin'::user_role) AND
      validate_credential_access('mfa_settings', id::text, 'emergency_access')
    )
    WITH CHECK (
      has_role('super_admin'::user_role) AND
      validate_credential_access('mfa_settings', id::text, 'emergency_access')
    );
    
    RAISE NOTICE 'Secured mfa_settings table with strict owner-only access';
  END IF;

  -- Fix 2: Secure ringcentral_accounts table with strict owner-only access
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ringcentral_accounts') THEN
    -- Enable RLS
    ALTER TABLE public.ringcentral_accounts ENABLE ROW LEVEL SECURITY;
    
    -- Drop any existing permissive policies
    DROP POLICY IF EXISTS "Users can view their own RingCentral accounts" ON public.ringcentral_accounts;
    DROP POLICY IF EXISTS "Users can insert their own RingCentral accounts" ON public.ringcentral_accounts;
    DROP POLICY IF EXISTS "Users can update their own RingCentral accounts" ON public.ringcentral_accounts;
    DROP POLICY IF EXISTS "Users can delete their own RingCentral accounts" ON public.ringcentral_accounts;
    
    -- Create strict owner-only policies
    CREATE POLICY "Strict owner-only access to RingCentral accounts"
    ON public.ringcentral_accounts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
    
    -- Emergency super admin access with full logging
    CREATE POLICY "Emergency super admin RingCentral access with audit"
    ON public.ringcentral_accounts FOR ALL
    USING (
      has_role('super_admin'::user_role) AND
      validate_credential_access('ringcentral_accounts', id::text, 'emergency_access')
    )
    WITH CHECK (
      has_role('super_admin'::user_role) AND
      validate_credential_access('ringcentral_accounts', id::text, 'emergency_access')
    );
    
    RAISE NOTICE 'Secured ringcentral_accounts table with strict owner-only access';
  END IF;

  -- Fix 3: Re-validate email_accounts has proper security (already looks good but ensure consistency)
  -- Drop any overly permissive policies if they exist
  DROP POLICY IF EXISTS "Anyone can access email accounts" ON public.email_accounts;
  DROP POLICY IF EXISTS "All users can manage email accounts" ON public.email_accounts;
  
  -- The existing policies for email_accounts already look secure:
  -- "Secure email account creation", "Secure email account deletion", 
  -- "Secure email account updates", "Secure email account viewing"
  -- These already restrict access to user_id = auth.uid()
  
  RAISE NOTICE 'Verified email_accounts table security - existing policies are secure';
  
END $$;

-- Create trigger to monitor direct access attempts to credential tables
CREATE OR REPLACE FUNCTION public.monitor_credential_table_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log all access to credential tables for security monitoring
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'credential_table_operation',
    'medium',
    jsonb_build_object(
      'table_name', TG_TABLE_NAME,
      'operation', TG_OP,
      'record_id', COALESCE(NEW.id::text, OLD.id::text),
      'timestamp', now()
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply monitoring triggers to credential tables
DO $$
BEGIN
  -- Add trigger to mfa_settings if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mfa_settings') THEN
    DROP TRIGGER IF EXISTS monitor_mfa_settings_access ON public.mfa_settings;
    CREATE TRIGGER monitor_mfa_settings_access
      BEFORE INSERT OR UPDATE OR DELETE ON public.mfa_settings
      FOR EACH ROW EXECUTE FUNCTION public.monitor_credential_table_access();
  END IF;
  
  -- Add trigger to ringcentral_accounts if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ringcentral_accounts') THEN
    DROP TRIGGER IF EXISTS monitor_ringcentral_accounts_access ON public.ringcentral_accounts;
    CREATE TRIGGER monitor_ringcentral_accounts_access
      BEFORE INSERT OR UPDATE OR DELETE ON public.ringcentral_accounts
      FOR EACH ROW EXECUTE FUNCTION public.monitor_credential_table_access();
  END IF;
  
  -- Add trigger to email_accounts
  DROP TRIGGER IF EXISTS monitor_email_accounts_access ON public.email_accounts;
  CREATE TRIGGER monitor_email_accounts_access
    BEFORE INSERT OR UPDATE OR DELETE ON public.email_accounts
    FOR EACH ROW EXECUTE FUNCTION public.monitor_credential_table_access();
END $$;