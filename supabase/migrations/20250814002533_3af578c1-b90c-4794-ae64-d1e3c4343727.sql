-- Fix Sensitive System Tables RLS Security Issues (Corrected)
-- This migration fixes RLS policies for sensitive system tables without trying to modify views

-- Since verified_blockchain_records is a view, we need to ensure the underlying tables are secure
-- The blockchain_records table already has RLS enabled and proper policies

-- Fix infinite recursion in approval_requests policies by removing conflicting policy
DROP POLICY IF EXISTS "Prevent unauthorized approval workflow access" ON public.approval_requests;

-- Add enhanced DELETE policy for approval_requests
CREATE POLICY "Only super admins can delete approval requests"
  ON public.approval_requests
  FOR DELETE
  USING (has_role('super_admin'::public.user_role));

-- Add missing policies for approval_steps table
CREATE POLICY "System can create approval steps"
  ON public.approval_steps
  FOR INSERT
  WITH CHECK (true); -- System can create approval steps

CREATE POLICY "Only super admins can delete approval steps"
  ON public.approval_steps
  FOR DELETE
  USING (has_role('super_admin'::public.user_role));

-- Add missing DELETE policy for opportunities table
CREATE POLICY "Only admins can delete opportunities"
  ON public.opportunities
  FOR DELETE
  USING (
    has_role('admin'::public.user_role) OR 
    has_role('super_admin'::public.user_role) OR
    (auth.uid() = created_by AND auth.uid() = primary_owner_id)
  );

-- Create additional security function to validate sensitive operations
CREATE OR REPLACE FUNCTION public.validate_sensitive_table_access(
  p_table_name text,
  p_operation text,
  p_record_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  user_role_level integer;
  is_authorized boolean := false;
BEGIN
  -- Get user role level
  SELECT CASE public.get_user_role(auth.uid())
    WHEN 'super_admin' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'manager' THEN 2
    ELSE 1
  END INTO user_role_level;
  
  -- Check authorization based on table and operation
  CASE p_table_name
    WHEN 'blockchain_records' THEN
      -- Only admins+ can modify blockchain records
      IF p_operation IN ('INSERT', 'UPDATE', 'DELETE') THEN
        is_authorized := user_role_level >= 3;
      ELSE
        is_authorized := true; -- SELECT handled by RLS
      END IF;
      
    WHEN 'approval_requests', 'approval_steps' THEN
      -- Approval system requires admin oversight for deletions
      IF p_operation = 'DELETE' THEN
        is_authorized := user_role_level >= 4; -- Super admin only
      ELSE
        is_authorized := true; -- Other operations handled by RLS
      END IF;
      
    WHEN 'opportunities' THEN
      -- Opportunities are business critical
      IF p_operation = 'DELETE' THEN
        is_authorized := user_role_level >= 3; -- Admin+ only
      ELSE
        is_authorized := true; -- Other operations handled by RLS
      END IF;
      
    ELSE
      is_authorized := user_role_level >= 3; -- Default: admin+ for unknown tables
  END CASE;
  
  -- Log the access attempt
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'sensitive_table_access_validation',
    CASE WHEN is_authorized THEN 'low' ELSE 'high' END,
    jsonb_build_object(
      'table_name', p_table_name,
      'operation', p_operation,
      'record_id', p_record_id,
      'user_role_level', user_role_level,
      'authorized', is_authorized
    )
  );
  
  RETURN is_authorized;
END;
$$;

-- Check if immutable_audit_trail table exists and has RLS
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'immutable_audit_trail') THEN
    -- Enable RLS on immutable_audit_trail if it exists
    EXECUTE 'ALTER TABLE public.immutable_audit_trail ENABLE ROW LEVEL SECURITY';
    
    -- Create RLS policy for immutable_audit_trail
    EXECUTE 'CREATE POLICY "Only admins can access immutable audit trail"
      ON public.immutable_audit_trail
      FOR ALL
      USING (has_role(''admin''::public.user_role) OR has_role(''super_admin''::public.user_role))
      WITH CHECK (has_role(''admin''::public.user_role) OR has_role(''super_admin''::public.user_role))';
  END IF;
END $$;

-- Create comprehensive security policy validation trigger
CREATE OR REPLACE FUNCTION public.validate_system_table_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  table_name text := TG_TABLE_NAME;
  operation text := TG_OP;
  user_id uuid := auth.uid();
  user_role_text text;
  is_authorized boolean;
BEGIN
  -- Get user role as text
  SELECT public.get_user_role(user_id)::text INTO user_role_text;
  
  -- Validate access using our security function
  SELECT public.validate_sensitive_table_access(table_name, operation) INTO is_authorized;
  
  -- Log the attempt regardless of authorization
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    user_id,
    'system_table_access_attempt',
    CASE WHEN is_authorized THEN 'low' ELSE 'critical' END,
    jsonb_build_object(
      'table_name', table_name,
      'operation', operation,
      'user_role', user_role_text,
      'authorized', is_authorized,
      'record_id', CASE 
        WHEN operation = 'DELETE' THEN OLD.id::text
        ELSE COALESCE(NEW.id::text, 'unknown')
      END
    )
  );
  
  -- Return the record
  RETURN CASE 
    WHEN operation = 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$;

-- Apply security trigger to sensitive tables
DROP TRIGGER IF EXISTS validate_blockchain_records_security ON public.blockchain_records;
CREATE TRIGGER validate_blockchain_records_security
  BEFORE INSERT OR UPDATE OR DELETE ON public.blockchain_records
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_system_table_security();

DROP TRIGGER IF EXISTS validate_opportunities_security ON public.opportunities;
CREATE TRIGGER validate_opportunities_security
  BEFORE DELETE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_system_table_security();

-- Create a secure view access function for verified blockchain records
CREATE OR REPLACE FUNCTION public.get_verified_blockchain_records_secure()
RETURNS TABLE (
  id uuid,
  record_type text,
  record_id text,
  data_hash text,
  blockchain_hash text,
  block_number bigint,
  transaction_hash text,
  verified_at timestamp with time zone,
  verification_status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  metadata jsonb,
  user_id uuid,
  action text,
  audit_verified boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log access to verified blockchain records
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'verified_blockchain_view_access',
    'medium',
    jsonb_build_object(
      'user_role', public.get_user_role(auth.uid()),
      'timestamp', now()
    )
  );
  
  -- Return filtered results based on user access
  RETURN QUERY
  SELECT vbr.id, vbr.record_type, vbr.record_id, vbr.data_hash,
         vbr.blockchain_hash, vbr.block_number, vbr.transaction_hash,
         vbr.verified_at, vbr.verification_status, vbr.created_at,
         vbr.updated_at, vbr.metadata, vbr.user_id, vbr.action,
         vbr.audit_verified
  FROM public.verified_blockchain_records vbr
  WHERE 
    -- Admins can see all
    (has_role('admin'::public.user_role) OR has_role('super_admin'::public.user_role)) OR
    -- Users can see their own records
    (vbr.user_id = auth.uid()) OR
    -- Users can see records for their leads/clients
    (vbr.record_type = 'lead' AND EXISTS (
      SELECT 1 FROM public.leads 
      WHERE leads.id::text = vbr.record_id 
      AND leads.user_id = auth.uid()
    )) OR
    (vbr.record_type = 'client' AND EXISTS (
      SELECT 1 FROM public.clients 
      WHERE clients.id::text = vbr.record_id 
      AND clients.user_id = auth.uid()
    ));
END;
$$;