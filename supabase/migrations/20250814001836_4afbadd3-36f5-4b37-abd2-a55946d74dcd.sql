-- Fix Admin Role Assignment Security Vulnerabilities
-- This migration implements strict controls on role assignment and requires proper authorization

-- Drop the overly permissive "System can insert roles" policy
DROP POLICY IF EXISTS "System can insert roles" ON public.user_roles;

-- Create a secure role assignment function that requires proper authorization
CREATE OR REPLACE FUNCTION public.assign_user_role(
  p_target_user_id uuid,
  p_new_role public.user_role,
  p_reason text DEFAULT 'Role assignment',
  p_mfa_verified boolean DEFAULT false
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  assigner_role public.user_role;
  target_current_role public.user_role;
  role_hierarchy jsonb := '{
    "super_admin": 4,
    "admin": 3,
    "manager": 2,
    "loan_originator": 1,
    "loan_processor": 1,
    "funder": 1,
    "underwriter": 1,
    "closer": 1,
    "agent": 1,
    "tech": 0,
    "viewer": 0
  }'::jsonb;
  assigner_level integer;
  target_level integer;
  new_role_level integer;
BEGIN
  -- Get the assigner's role
  SELECT public.get_user_role(auth.uid()) INTO assigner_role;
  
  -- Get target user's current role
  SELECT public.get_user_role(p_target_user_id) INTO target_current_role;
  
  -- Check if assigner has permission
  IF assigner_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: No role assigned');
  END IF;
  
  -- Get hierarchy levels
  assigner_level := COALESCE((role_hierarchy->>assigner_role::text)::integer, 0);
  target_level := COALESCE((role_hierarchy->>target_current_role::text)::integer, 0);
  new_role_level := COALESCE((role_hierarchy->>p_new_role::text)::integer, 0);
  
  -- Security checks
  IF assigner_level < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient privileges: Admin role required');
  END IF;
  
  -- Super admin assignment requires super admin
  IF p_new_role = 'super_admin' AND assigner_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only super admins can assign super admin role');
  END IF;
  
  -- Cannot assign role higher than your own
  IF new_role_level > assigner_level THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot assign role higher than your own');
  END IF;
  
  -- MFA requirement for sensitive role changes
  IF (p_new_role IN ('super_admin', 'admin') OR target_current_role IN ('super_admin', 'admin')) 
     AND NOT p_mfa_verified THEN
    RETURN jsonb_build_object('success', false, 'error', 'MFA verification required for admin role changes');
  END IF;
  
  -- Prevent self-demotion from super_admin
  IF auth.uid() = p_target_user_id AND assigner_role = 'super_admin' AND p_new_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Super admins cannot demote themselves');
  END IF;
  
  -- Update the role
  UPDATE public.user_roles 
  SET role = p_new_role, updated_at = now()
  WHERE user_id = p_target_user_id;
  
  -- Log the role change with high security
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'role_assignment',
    CASE 
      WHEN p_new_role IN ('super_admin', 'admin') THEN 'critical'
      ELSE 'high'
    END,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'old_role', target_current_role,
      'new_role', p_new_role,
      'reason', p_reason,
      'mfa_verified', p_mfa_verified,
      'assigner_role', assigner_role
    )
  );
  
  -- Create audit log entry
  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, old_values, new_values
  ) VALUES (
    auth.uid(),
    'role_assignment',
    'user_roles',
    p_target_user_id::text,
    jsonb_build_object('role', target_current_role),
    jsonb_build_object('role', p_new_role, 'reason', p_reason)
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'Role assigned successfully');
END;
$$;

-- Create a function to revoke user roles with proper authorization
CREATE OR REPLACE FUNCTION public.revoke_user_role(
  p_target_user_id uuid,
  p_reason text DEFAULT 'Role revocation',
  p_mfa_verified boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  assigner_role public.user_role;
  target_current_role public.user_role;
BEGIN
  -- Get roles
  SELECT public.get_user_role(auth.uid()) INTO assigner_role;
  SELECT public.get_user_role(p_target_user_id) INTO target_current_role;
  
  -- Security checks
  IF assigner_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only super admins can revoke roles');
  END IF;
  
  -- MFA requirement for admin role revocation
  IF target_current_role IN ('super_admin', 'admin') AND NOT p_mfa_verified THEN
    RETURN jsonb_build_object('success', false, 'error', 'MFA verification required for admin role revocation');
  END IF;
  
  -- Prevent self-revocation
  IF auth.uid() = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot revoke your own role');
  END IF;
  
  -- Deactivate the role
  UPDATE public.user_roles 
  SET is_active = false, updated_at = now()
  WHERE user_id = p_target_user_id;
  
  -- Log the revocation
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'role_revocation',
    'critical',
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'revoked_role', target_current_role,
      'reason', p_reason,
      'mfa_verified', p_mfa_verified
    )
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'Role revoked successfully');
END;
$$;

-- Create new secure RLS policies for user_roles
CREATE POLICY "Secure role viewing for authorized users"
  ON public.user_roles
  FOR SELECT
  USING (
    auth.uid() = user_id OR -- Users can see their own role
    has_role('admin'::public.user_role) OR -- Admins can see all roles
    has_role('super_admin'::public.user_role) -- Super admins can see all roles
  );

-- Prevent direct role insertion - must use the secure function
CREATE POLICY "Role assignment only through secure function"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (false); -- Block all direct inserts

-- Prevent direct role updates - must use the secure function  
CREATE POLICY "Role updates only through secure function"
  ON public.user_roles
  FOR UPDATE
  USING (false); -- Block all direct updates

-- Only super admins can delete roles directly (for emergency cleanup)
CREATE POLICY "Only super admins can delete roles"
  ON public.user_roles
  FOR DELETE
  USING (has_role('super_admin'::public.user_role));

-- Create a table to track MFA verifications for role changes
CREATE TABLE IF NOT EXISTS public.role_change_mfa_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  verification_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '5 minutes'),
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on MFA verification table
ALTER TABLE public.role_change_mfa_verifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for MFA verification table
CREATE POLICY "Users can manage their own MFA verifications"
  ON public.role_change_mfa_verifications
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create function to generate MFA verification for role changes
CREATE OR REPLACE FUNCTION public.generate_role_change_mfa_verification()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  verification_token text;
  verification_id uuid;
BEGIN
  -- Generate secure token
  verification_token := encode(gen_random_bytes(32), 'hex');
  
  -- Insert verification record
  INSERT INTO public.role_change_mfa_verifications (
    user_id, verification_token
  ) VALUES (
    auth.uid(), verification_token
  ) RETURNING id INTO verification_id;
  
  -- Log MFA request
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'role_change_mfa_requested',
    'medium',
    jsonb_build_object('verification_id', verification_id)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'verification_token', verification_token,
    'expires_in_minutes', 5
  );
END;
$$;

-- Create function to verify MFA token for role changes
CREATE OR REPLACE FUNCTION public.verify_role_change_mfa(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  verification_record RECORD;
BEGIN
  -- Find valid verification
  SELECT * INTO verification_record
  FROM public.role_change_mfa_verifications
  WHERE user_id = auth.uid()
    AND verification_token = p_token
    AND expires_at > now()
    AND used_at IS NULL;
  
  IF NOT FOUND THEN
    -- Log failed verification
    INSERT INTO public.security_events (
      user_id, event_type, severity, details
    ) VALUES (
      auth.uid(),
      'role_change_mfa_failed',
      'high',
      jsonb_build_object('token_provided', left(p_token, 8) || '...')
    );
    
    RETURN false;
  END IF;
  
  -- Mark as used
  UPDATE public.role_change_mfa_verifications
  SET used_at = now()
  WHERE id = verification_record.id;
  
  -- Log successful verification
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'role_change_mfa_verified',
    'medium',
    jsonb_build_object('verification_id', verification_record.id)
  );
  
  RETURN true;
END;
$$;