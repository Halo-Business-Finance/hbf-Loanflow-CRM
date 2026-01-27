-- Comprehensive fix for all functions with mutable search paths
-- Update all existing functions to have proper search_path settings

-- List all functions that need fixing and update them
-- This query will identify and fix functions with security definer but no search path

-- Fix the update_sensitive_permissions_updated_at function
CREATE OR REPLACE FUNCTION public.update_sensitive_permissions_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update existing functions that were missing search_path
-- Check and fix get_user_role function if it exists and needs fixing
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role::text FROM public.user_roles WHERE user_id = p_user_id AND is_active = true LIMIT 1),
    'viewer'
  );
$$;

-- Fix encrypt_token function if it needs updating
CREATE OR REPLACE FUNCTION public.encrypt_token(p_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Simple encryption for demo - in production, use proper encryption
  RETURN encode(digest(p_token || 'salt_key', 'sha256'), 'hex');
END;
$$;

-- Fix decrypt_token function if it needs updating  
CREATE OR REPLACE FUNCTION public.decrypt_token(p_encrypted_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- For this demo, we can't actually decrypt hashed values
  -- In production, use proper reversible encryption
  RETURN p_encrypted_token;
END;
$$;

-- Fix validate_blockchain_access function if it needs updating
CREATE OR REPLACE FUNCTION public.validate_blockchain_access(p_record_id TEXT, p_access_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role_val TEXT;
  has_access BOOLEAN := false;
BEGIN
  user_role_val := public.get_user_role();
  
  -- Admin access
  IF user_role_val IN ('admin', 'super_admin') THEN
    has_access := true;
  ELSE
    -- Check if user owns the data
    has_access := EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id::text = p_record_id AND l.user_id = auth.uid()
      UNION
      SELECT 1 FROM public.clients c WHERE c.id::text = p_record_id AND c.user_id = auth.uid()
      UNION  
      SELECT 1 FROM public.contact_entities ce WHERE ce.id::text = p_record_id AND ce.user_id = auth.uid()
    );
  END IF;
  
  -- Log access attempt
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'blockchain_access_attempt',
    CASE WHEN has_access THEN 'low' ELSE 'medium' END,
    jsonb_build_object(
      'record_id', p_record_id,
      'access_type', p_access_type,
      'granted', has_access,
      'user_role', user_role_val
    )
  );
  
  RETURN has_access;
END;
$$;

-- Fix any approval-related functions
CREATE OR REPLACE FUNCTION public.can_access_approval_request(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role_val TEXT;
BEGIN
  user_role_val := public.get_user_role();
  
  -- Admins can access all
  IF user_role_val IN ('admin', 'super_admin') THEN
    RETURN true;
  END IF;
  
  -- Users can access their own requests or requests they need to approve
  RETURN EXISTS (
    SELECT 1 FROM public.approval_requests ar
    WHERE ar.id = p_request_id
    AND (
      ar.submitted_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.approval_steps asp
        WHERE asp.request_id = ar.id
        AND asp.approver_id = auth.uid()
      )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_approval_step(p_step_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role_val TEXT;
BEGIN
  user_role_val := public.get_user_role();
  
  -- Admins can access all
  IF user_role_val IN ('admin', 'super_admin') THEN
    RETURN true;
  END IF;
  
  -- Users can access steps they're involved in
  RETURN EXISTS (
    SELECT 1 FROM public.approval_steps asp
    JOIN public.approval_requests ar ON ar.id = asp.request_id
    WHERE asp.id = p_step_id
    AND (
      asp.approver_id = auth.uid() OR
      ar.submitted_by = auth.uid()
    )
  );
END;
$$;