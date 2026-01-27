-- Fix search_path security issue for database functions
-- This prevents potential SQL injection and ensures functions run in a secure context

-- Create or replace functions with proper search_path settings
-- These are security validation functions referenced in RLS policies

CREATE OR REPLACE FUNCTION public.validate_sensitive_table_access(
  table_name text DEFAULT NULL,
  requesting_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  user_role text;
BEGIN
  -- Get user role safely
  SELECT public.get_user_role(requesting_user_id)::text INTO user_role;
  
  -- Allow super admins and admins full access
  IF user_role IN ('super_admin', 'admin') THEN
    RETURN true;
  END IF;
  
  -- Default to restrictive access
  RETURN false;
END;
$$;

-- Create secure blockchain access function
CREATE OR REPLACE FUNCTION public.get_verified_blockchain_records_secure()
RETURNS TABLE(
  id uuid,
  record_type text,
  record_id text,
  verification_status text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only allow admins to access blockchain records
  IF NOT public.has_role('admin'::public.user_role) THEN
    RAISE EXCEPTION 'Unauthorized access to blockchain records';
  END IF;
  
  RETURN QUERY
  SELECT 
    br.id,
    br.record_type,
    br.record_id,
    br.verification_status,
    br.created_at
  FROM public.blockchain_records br
  WHERE br.verification_status = 'verified'
  ORDER BY br.created_at DESC;
END;
$$;

-- Create approval access validation functions
CREATE OR REPLACE FUNCTION public.can_access_approval_request(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  user_role text;
  requesting_user uuid;
BEGIN
  requesting_user := auth.uid();
  user_role := public.get_user_role(requesting_user)::text;
  
  -- Super admins and admins can access all requests
  IF user_role IN ('super_admin', 'admin') THEN
    RETURN true;
  END IF;
  
  -- Users can access their own submitted requests
  IF EXISTS (
    SELECT 1 FROM public.approval_requests ar
    WHERE ar.id = request_id AND ar.submitted_by = requesting_user
  ) THEN
    RETURN true;
  END IF;
  
  -- Approvers can access requests they need to approve
  IF EXISTS (
    SELECT 1 FROM public.approval_steps ast
    WHERE ast.request_id = can_access_approval_request.request_id 
    AND ast.approver_id = requesting_user
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_approval_step(step_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  user_role text;
  requesting_user uuid;
BEGIN
  requesting_user := auth.uid();
  user_role := public.get_user_role(requesting_user)::text;
  
  -- Super admins and admins can access all steps
  IF user_role IN ('super_admin', 'admin') THEN
    RETURN true;
  END IF;
  
  -- Approvers can access their own steps
  IF EXISTS (
    SELECT 1 FROM public.approval_steps ast
    WHERE ast.id = step_id AND ast.approver_id = requesting_user
  ) THEN
    RETURN true;
  END IF;
  
  -- Users can access steps for requests they submitted
  IF EXISTS (
    SELECT 1 FROM public.approval_steps ast
    JOIN public.approval_requests ar ON ar.id = ast.request_id
    WHERE ast.id = step_id AND ar.submitted_by = requesting_user
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;