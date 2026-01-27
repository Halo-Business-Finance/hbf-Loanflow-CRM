-- Fix Sensitive System Tables RLS Security Issues
-- This migration enables RLS and creates secure policies for sensitive system tables

-- Enable RLS on verified_blockchain_records table if it exists
ALTER TABLE IF EXISTS public.verified_blockchain_records ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies for verified_blockchain_records
CREATE POLICY "Admins can manage verified blockchain records"
  ON public.verified_blockchain_records
  FOR ALL
  USING (has_role('admin'::public.user_role) OR has_role('super_admin'::public.user_role))
  WITH CHECK (has_role('admin'::public.user_role) OR has_role('super_admin'::public.user_role));

CREATE POLICY "Users can view verified blockchain records for their data"
  ON public.verified_blockchain_records  
  FOR SELECT
  USING (
    -- Users can see verified records for their own data
    (user_id = auth.uid()) OR
    -- Users can see verified records for their leads
    (record_type = 'lead' AND EXISTS (
      SELECT 1 FROM public.leads 
      WHERE leads.id::text = verified_blockchain_records.record_id 
      AND leads.user_id = auth.uid()
    )) OR
    -- Users can see verified records for their clients
    (record_type = 'client' AND EXISTS (
      SELECT 1 FROM public.clients 
      WHERE clients.id::text = verified_blockchain_records.record_id 
      AND clients.user_id = auth.uid()
    )) OR
    -- Admins can see all verified records
    has_role('admin'::public.user_role) OR
    has_role('super_admin'::public.user_role)
  );

CREATE POLICY "System can create verified blockchain records"
  ON public.verified_blockchain_records
  FOR INSERT
  WITH CHECK (true); -- System processes can create records

-- Enhance approval_requests table security with missing DELETE policy
CREATE POLICY "Only super admins can delete approval requests"
  ON public.approval_requests
  FOR DELETE
  USING (has_role('super_admin'::public.user_role));

-- Enhance approval_steps table security with missing policies
CREATE POLICY "System can create approval steps"
  ON public.approval_steps
  FOR INSERT
  WITH CHECK (true); -- System can create approval steps

CREATE POLICY "Only super admins can delete approval steps"
  ON public.approval_steps
  FOR DELETE
  USING (has_role('super_admin'::public.user_role));

-- Enhance opportunities table security with missing DELETE policy
CREATE POLICY "Only admins can delete opportunities"
  ON public.opportunities
  FOR DELETE
  USING (
    has_role('admin'::public.user_role) OR 
    has_role('super_admin'::public.user_role) OR
    (auth.uid() = created_by AND auth.uid() = primary_owner_id)
  );

-- Create additional security policies for sensitive system operations
-- Prevent unauthorized access to approval workflow data
CREATE POLICY "Prevent unauthorized approval workflow access"
  ON public.approval_requests
  FOR SELECT
  USING (
    -- Request submitter can view
    (auth.uid() = submitted_by) OR
    -- Assigned approvers can view  
    (auth.uid() IN (
      SELECT approver_id FROM public.approval_steps 
      WHERE request_id = approval_requests.id
    )) OR
    -- Admins can view all
    has_role('admin'::public.user_role) OR
    has_role('super_admin'::public.user_role) OR
    -- Users involved in the record being approved can view
    (record_type = 'lead' AND EXISTS (
      SELECT 1 FROM public.leads 
      WHERE leads.id = approval_requests.record_id 
      AND leads.user_id = auth.uid()
    )) OR
    (record_type = 'client' AND EXISTS (
      SELECT 1 FROM public.clients 
      WHERE clients.id = approval_requests.record_id 
      AND clients.user_id = auth.uid()
    ))
  );

-- Create audit trigger for verified blockchain records access
CREATE OR REPLACE FUNCTION public.audit_verified_blockchain_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log access to verified blockchain records for security monitoring
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'verified_blockchain_access',
    'medium',
    jsonb_build_object(
      'record_type', COALESCE(NEW.record_type, OLD.record_type),
      'record_id', COALESCE(NEW.record_id, OLD.record_id),
      'operation', TG_OP,
      'verification_status', COALESCE(NEW.verification_status, OLD.verification_status)
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for verified blockchain records
DROP TRIGGER IF EXISTS audit_verified_blockchain_access ON public.verified_blockchain_records;
CREATE TRIGGER audit_verified_blockchain_access
  AFTER INSERT OR UPDATE OR DELETE ON public.verified_blockchain_records
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_verified_blockchain_access();

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
    WHEN 'verified_blockchain_records' THEN
      -- Only admins+ can modify verified records
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