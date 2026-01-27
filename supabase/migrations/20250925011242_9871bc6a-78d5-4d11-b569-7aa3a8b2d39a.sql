-- CRITICAL SECURITY FIX: Drop specific function and implement clean security policies
-- Phase 1: Immediate Critical Fixes (Drop Existing Function)

-- 1. Drop the existing function with its exact signature
DROP FUNCTION IF EXISTS public.validate_sensitive_table_access(table_name text, requesting_user_id uuid);

-- 2. Create new validation function with proper signature
CREATE FUNCTION public.validate_sensitive_table_access(
  table_name text, 
  operation text, 
  record_id text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_val text;
  user_id_val uuid;
BEGIN
  user_id_val := auth.uid();
  
  -- Require authentication
  IF user_id_val IS NULL THEN
    RETURN false;
  END IF;
  
  user_role_val := public.get_user_role(user_id_val)::text;
  
  -- Log all sensitive table access for security monitoring
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    user_id_val,
    'sensitive_table_access',
    CASE 
      WHEN user_role_val IN ('super_admin', 'admin') THEN 'low'
      ELSE 'medium'
    END,
    jsonb_build_object(
      'table_name', table_name,
      'operation', operation,
      'record_id', record_id,
      'user_role', user_role_val
    )
  );
  
  -- Role-based authorization
  CASE table_name
    WHEN 'contact_entities' THEN
      RETURN user_role_val IN ('super_admin', 'admin', 'manager', 'agent', 'loan_processor', 'underwriter', 'funder', 'closer');
    WHEN 'security_alerts', 'threat_incidents', 'failed_login_attempts', 'account_lockouts' THEN
      RETURN user_role_val IN ('super_admin', 'admin');
    WHEN 'audit_logs' THEN
      RETURN user_role_val IN ('super_admin', 'admin');
    ELSE
      RETURN user_role_val IN ('super_admin', 'admin');
  END CASE;
END;
$$;

-- 3. Fix contact_entities RLS policies (CRITICAL - Financial Data Protection)
DROP POLICY IF EXISTS "Role-based contact entities delete" ON public.contact_entities;
DROP POLICY IF EXISTS "Role-based contact entities insert" ON public.contact_entities;
DROP POLICY IF EXISTS "Role-based contact entities update" ON public.contact_entities;
DROP POLICY IF EXISTS "Secure contact entities access with need-to-know" ON public.contact_entities;

-- Create secure contact_entities policies
CREATE POLICY "Secure contact entities select" ON public.contact_entities
FOR SELECT USING (
  (auth.uid() = user_id) OR -- Owner access
  (has_role('super_admin'::user_role)) OR -- Super admin access
  (has_role('admin'::user_role) AND validate_sensitive_table_access('contact_entities', 'SELECT', id::text))
);

CREATE POLICY "Secure contact entities insert" ON public.contact_entities
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  validate_sensitive_table_access('contact_entities', 'INSERT')
);

CREATE POLICY "Secure contact entities update" ON public.contact_entities
FOR UPDATE USING (
  (auth.uid() = user_id) OR
  (has_role('admin'::user_role) AND validate_sensitive_table_access('contact_entities', 'UPDATE', id::text))
) WITH CHECK (
  (auth.uid() = user_id) OR
  (has_role('admin'::user_role) AND validate_sensitive_table_access('contact_entities', 'UPDATE', id::text))
);

CREATE POLICY "Secure contact entities delete" ON public.contact_entities
FOR DELETE USING (
  (auth.uid() = user_id AND has_role('admin'::user_role)) OR
  has_role('super_admin'::user_role)
);

-- 4. Secure audit logs (CRITICAL)
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;

CREATE POLICY "Secure audit logs access" ON public.audit_logs
FOR SELECT USING (
  (auth.uid() = user_id) OR -- Users can see their own logs
  has_role('super_admin'::user_role) OR
  (has_role('admin'::user_role) AND validate_sensitive_table_access('audit_logs', 'SELECT', id::text))
);

-- 5. Secure account lockouts
DROP POLICY IF EXISTS "System can insert account lockouts" ON public.account_lockouts;
DROP POLICY IF EXISTS "Admins can manage account lockouts" ON public.account_lockouts;
DROP POLICY IF EXISTS "Only admins can view account lockouts" ON public.account_lockouts;

CREATE POLICY "Secure account lockouts select" ON public.account_lockouts
FOR SELECT USING (
  has_role('super_admin'::user_role) OR
  (has_role('admin'::user_role) AND validate_sensitive_table_access('account_lockouts', 'SELECT', id::text))
);

CREATE POLICY "System can create account lockouts" ON public.account_lockouts
FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update account lockouts" ON public.account_lockouts
FOR UPDATE USING (
  has_role('super_admin'::user_role) OR
  (has_role('admin'::user_role) AND validate_sensitive_table_access('account_lockouts', 'UPDATE', id::text))
);

-- 6. Enhanced immutable audit trail security
ALTER TABLE public.immutable_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins only access immutable audit trail" ON public.immutable_audit_trail
FOR ALL USING (
  has_role('super_admin'::user_role) OR
  (has_role('admin'::user_role) AND validate_sensitive_table_access('immutable_audit_trail', 'ACCESS', id::text))
);

COMMENT ON FUNCTION public.validate_sensitive_table_access IS 'SECURITY CRITICAL: Validates all access to sensitive data tables with comprehensive role-based authorization and audit logging';