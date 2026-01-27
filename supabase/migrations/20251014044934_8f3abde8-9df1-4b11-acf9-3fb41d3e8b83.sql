-- Fix assign_user_role to handle unique constraint properly
-- Delete old roles and insert new one instead of UPDATE
CREATE OR REPLACE FUNCTION public.assign_user_role(
  p_target_user_id uuid,
  p_new_role user_role,
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
  
  -- Prevent self-demotion from super_admin
  IF auth.uid() = p_target_user_id AND assigner_role = 'super_admin' AND p_new_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Super admins cannot demote themselves');
  END IF;
  
  -- Delete existing roles for this user to avoid unique constraint violations
  DELETE FROM public.user_roles WHERE user_id = p_target_user_id;
  
  -- Insert the new role
  INSERT INTO public.user_roles (user_id, role, created_at, updated_at)
  VALUES (p_target_user_id, p_new_role, now(), now());
  
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

-- Fix revoke_user_role similarly
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
  revoker_role public.user_role;
  target_current_role public.user_role;
BEGIN
  -- Get the revoker's role
  SELECT public.get_user_role(auth.uid()) INTO revoker_role;
  
  -- Get target user's current role
  SELECT public.get_user_role(p_target_user_id) INTO target_current_role;
  
  -- Check if revoker has permission (must be admin or super_admin)
  IF revoker_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient privileges: Admin role required');
  END IF;
  
  -- Only super admins can revoke super admin roles
  IF target_current_role = 'super_admin' AND revoker_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only super admins can revoke super admin roles');
  END IF;
  
  -- Prevent self-revocation
  IF auth.uid() = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot revoke your own role');
  END IF;
  
  -- Delete existing roles and set to 'viewer' (lowest level)
  DELETE FROM public.user_roles WHERE user_id = p_target_user_id;
  
  INSERT INTO public.user_roles (user_id, role, created_at, updated_at)
  VALUES (p_target_user_id, 'viewer', now(), now());
  
  -- Log the role revocation
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
      'revoker_role', revoker_role
    )
  );
  
  -- Create audit log entry
  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, old_values, new_values
  ) VALUES (
    auth.uid(),
    'role_revocation',
    'user_roles',
    p_target_user_id::text,
    jsonb_build_object('role', target_current_role),
    jsonb_build_object('role', 'viewer', 'reason', p_reason)
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'Role revoked successfully');
END;
$$;