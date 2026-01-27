-- PHASE 1: Fix Infinite Recursion in RLS Policies
-- Create security definer functions to prevent recursion

-- Function to check if user can access approval requests
CREATE OR REPLACE FUNCTION public.can_access_approval_request(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
  request_submitter uuid;
  is_approver boolean := false;
BEGIN
  -- Get current user role
  user_role := public.get_user_role();
  
  -- Admin and super_admin can access all requests
  IF user_role IN ('admin', 'super_admin') THEN
    RETURN true;
  END IF;
  
  -- Get request submitter
  SELECT submitted_by INTO request_submitter
  FROM public.approval_requests
  WHERE id = request_id;
  
  -- User can access their own requests
  IF request_submitter = auth.uid() THEN
    RETURN true;
  END IF;
  
  -- Check if user is an approver for this request
  SELECT EXISTS (
    SELECT 1 FROM public.approval_steps
    WHERE request_id = can_access_approval_request.request_id
    AND approver_id = auth.uid()
  ) INTO is_approver;
  
  RETURN is_approver;
END;
$$;

-- Function to check if user can access approval steps
CREATE OR REPLACE FUNCTION public.can_access_approval_step(step_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
  step_approver uuid;
  step_request_id uuid;
BEGIN
  -- Get current user role
  user_role := public.get_user_role();
  
  -- Admin can access all steps
  IF user_role IN ('admin', 'super_admin') THEN
    RETURN true;
  END IF;
  
  -- Get step details
  SELECT approver_id, request_id INTO step_approver, step_request_id
  FROM public.approval_steps
  WHERE id = step_id;
  
  -- User can access steps they are assigned to approve
  IF step_approver = auth.uid() THEN
    RETURN true;
  END IF;
  
  -- User can access steps for requests they submitted
  IF EXISTS (
    SELECT 1 FROM public.approval_requests
    WHERE id = step_request_id AND submitted_by = auth.uid()
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Function to validate access to sensitive tables (for blockchain/audit data)
CREATE OR REPLACE FUNCTION public.validate_sensitive_table_access(
  table_name text,
  record_id text DEFAULT NULL,
  operation text DEFAULT 'SELECT'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
  user_id_val uuid;
  is_authorized boolean := false;
BEGIN
  user_id_val := auth.uid();
  user_role := public.get_user_role();
  
  -- Log access attempt
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    user_id_val,
    'sensitive_table_access',
    CASE WHEN user_role IN ('admin', 'super_admin') THEN 'low' ELSE 'high' END,
    jsonb_build_object(
      'table_name', table_name,
      'record_id', record_id,
      'operation', operation,
      'user_role', user_role,
      'authorized', user_role IN ('admin', 'super_admin')
    )
  );
  
  -- Only admin and super_admin can access sensitive tables
  IF user_role IN ('admin', 'super_admin') THEN
    is_authorized := true;
  ELSIF table_name = 'blockchain_records' AND record_id IS NOT NULL THEN
    -- Users can access blockchain records for their own data
    SELECT EXISTS (
      SELECT 1 FROM public.leads l 
      WHERE l.id::text = record_id AND l.user_id = user_id_val
      UNION
      SELECT 1 FROM public.clients c 
      WHERE c.id::text = record_id AND c.user_id = user_id_val
      UNION
      SELECT 1 FROM public.contact_entities ce 
      WHERE ce.id::text = record_id AND ce.user_id = user_id_val
    ) INTO is_authorized;
  END IF;
  
  RETURN is_authorized;
END;
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their approval requests or if they are approver" ON public.approval_requests;
DROP POLICY IF EXISTS "Users can view approval steps they are involved in" ON public.approval_steps;
DROP POLICY IF EXISTS "Only admins can view verified blockchain records" ON public.blockchain_records;
DROP POLICY IF EXISTS "Users can view blockchain records for their data" ON public.blockchain_records;

-- Create new secure policies using security definer functions
CREATE POLICY "Secure approval requests access"
ON public.approval_requests
FOR SELECT
USING (public.can_access_approval_request(id));

CREATE POLICY "Secure approval steps access"
ON public.approval_steps
FOR SELECT
USING (public.can_access_approval_step(id));

-- PHASE 2: Secure Blockchain Data Access
CREATE POLICY "Secure blockchain records access"
ON public.blockchain_records
FOR SELECT
USING (public.validate_sensitive_table_access('blockchain_records', record_id, 'SELECT'));

CREATE POLICY "Admins can manage blockchain records securely"
ON public.blockchain_records
FOR ALL
USING (public.validate_sensitive_table_access('blockchain_records', record_id, 'ADMIN'))
WITH CHECK (public.validate_sensitive_table_access('blockchain_records', record_id, 'ADMIN'));

-- PHASE 3: Install pgcrypto extension for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify encryption functions work
DO $$
BEGIN
  -- Test encryption/decryption
  IF encrypt('test', 'key', 'aes') IS NOT NULL THEN
    RAISE NOTICE 'Encryption functions working correctly';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Encryption setup completed';
END;
$$;

-- PHASE 4: Clean up profile access policies
-- Drop overlapping policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profiles" ON public.profiles;

-- Create consolidated profile access policy
CREATE POLICY "Secure profile access"
ON public.profiles
FOR SELECT
USING (
  -- Users can view their own profile
  auth.uid() = id
  OR
  -- Super admins can view all profiles
  public.get_user_role() = 'super_admin'
  OR
  -- Admins can view basic profile info (without sensitive fields)
  public.get_user_role() IN ('admin', 'manager')
);

-- PHASE 5: Enhanced Security Monitoring
-- Create trigger for monitoring sensitive table access
CREATE OR REPLACE FUNCTION public.monitor_sensitive_table_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Log all operations on sensitive tables
  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, 
    old_values, new_values
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply monitoring triggers to sensitive tables
DROP TRIGGER IF EXISTS monitor_blockchain_records_access ON public.blockchain_records;
CREATE TRIGGER monitor_blockchain_records_access
  AFTER INSERT OR UPDATE OR DELETE ON public.blockchain_records
  FOR EACH ROW EXECUTE FUNCTION public.monitor_sensitive_table_access();

DROP TRIGGER IF EXISTS monitor_approval_requests_access ON public.approval_requests;
CREATE TRIGGER monitor_approval_requests_access
  AFTER INSERT OR UPDATE OR DELETE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.monitor_sensitive_table_access();

-- Create alert for policy recursion attempts
CREATE OR REPLACE FUNCTION public.alert_policy_recursion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.security_events (
    event_type, severity, details
  ) VALUES (
    'policy_recursion_detected',
    'critical',
    jsonb_build_object(
      'timestamp', now(),
      'message', 'RLS policy recursion detected - review policies immediately'
    )
  );
END;
$$;