-- Fix search_path security issue for database functions
-- This migration ensures all functions have proper SET search_path TO '' for security

-- Drop existing function that might have different signature
DROP FUNCTION IF EXISTS public.get_verified_blockchain_records_secure();

-- Create all required security functions with proper search_path settings

-- 1. Validate sensitive table access function
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

-- 2. Secure blockchain records access function
CREATE OR REPLACE FUNCTION public.get_verified_blockchain_records_secure()
RETURNS SETOF public.blockchain_records
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
  SELECT * FROM public.blockchain_records
  WHERE verification_status = 'verified'
  ORDER BY created_at DESC;
END;
$$;

-- 3. Approval request access validation
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
  
  IF requesting_user IS NULL THEN
    RETURN false;
  END IF;
  
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

-- 4. Approval step access validation
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
  
  IF requesting_user IS NULL THEN
    RETURN false;
  END IF;
  
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