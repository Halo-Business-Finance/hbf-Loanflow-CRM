-- Fix infinite recursion in RLS policies and tighten security

-- Drop existing function to avoid parameter conflicts
DROP FUNCTION IF EXISTS public.get_user_role(uuid);

-- Create security definer function to check user roles without recursion
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid DEFAULT auth.uid())
RETURNS user_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = p_user_id 
  AND is_active = true 
  LIMIT 1;
$$;

-- Drop existing problematic policies on approval_requests
DROP POLICY IF EXISTS "Users can view relevant approval requests" ON public.approval_requests;

-- Create new safe policy for approval_requests
CREATE POLICY "Users can view their approval requests or if they are approver"
ON public.approval_requests
FOR SELECT
USING (
  auth.uid() = submitted_by OR 
  get_user_role() = 'admin' OR
  auth.uid() IN (
    SELECT approver_id FROM approval_steps 
    WHERE request_id = approval_requests.id
  )
);

-- Drop existing problematic policies on approval_steps  
DROP POLICY IF EXISTS "Users can view relevant approval steps" ON public.approval_steps;

-- Create new safe policy for approval_steps
CREATE POLICY "Users can view approval steps they are involved in"
ON public.approval_steps
FOR SELECT
USING (
  auth.uid() = approver_id OR 
  get_user_role() = 'admin' OR
  EXISTS (
    SELECT 1 FROM approval_requests 
    WHERE id = approval_steps.request_id 
    AND submitted_by = auth.uid()
  )
);

-- Tighten contact_entities policies to prevent data exposure
DROP POLICY IF EXISTS "Users can view only their own contact entities" ON public.contact_entities;

CREATE POLICY "Strict contact entity access control"
ON public.contact_entities
FOR SELECT
USING (
  auth.uid() = user_id OR 
  get_user_role() IN ('admin', 'super_admin')
);

-- Secure account lockouts - only admins and system should access
DROP POLICY IF EXISTS "Users can view their own lockouts" ON public.account_lockouts;

CREATE POLICY "Only admins can view account lockouts"
ON public.account_lockouts
FOR SELECT
USING (get_user_role() IN ('admin', 'super_admin'));

-- Add security event logging for policy violations
CREATE OR REPLACE FUNCTION public.log_policy_violation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'rls_policy_violation',
    'high',
    jsonb_build_object(
      'table_name', TG_TABLE_NAME,
      'operation', TG_OP,
      'timestamp', now()
    )
  );
  RETURN NULL;
END;
$$;