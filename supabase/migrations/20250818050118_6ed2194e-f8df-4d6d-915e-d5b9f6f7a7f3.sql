-- Fix security warning: Function Search Path Mutable
-- Update function search_path settings to be immutable

-- Fix has_sensitive_data_permission function
CREATE OR REPLACE FUNCTION public.has_sensitive_data_permission(
  p_admin_user_id UUID,
  p_target_user_id UUID,
  p_permission_type TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'  -- Fixed: Set to specific schema instead of empty string
AS $$
DECLARE
  permission_exists BOOLEAN := false;
BEGIN
  -- Super admins with emergency access (but still logged)
  IF public.get_user_role(p_admin_user_id) = 'super_admin' THEN
    -- Log the emergency access
    INSERT INTO public.sensitive_data_access_logs (
      admin_user_id, target_user_id, data_type, access_reason
    ) VALUES (
      p_admin_user_id, p_target_user_id, p_permission_type, 'EMERGENCY_SUPER_ADMIN_ACCESS'
    );
    RETURN true;
  END IF;
  
  -- Check for explicit permission
  SELECT EXISTS (
    SELECT 1 FROM public.sensitive_data_permissions
    WHERE admin_user_id = p_admin_user_id
    AND target_user_id = p_target_user_id
    AND permission_type = p_permission_type
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  ) INTO permission_exists;
  
  -- Update access count if permission exists
  IF permission_exists THEN
    UPDATE public.sensitive_data_permissions
    SET access_count = access_count + 1,
        last_accessed = now()
    WHERE admin_user_id = p_admin_user_id
    AND target_user_id = p_target_user_id
    AND permission_type = p_permission_type
    AND is_active = true;
  END IF;
  
  RETURN permission_exists;
END;
$$;

-- Fix log_sensitive_data_access function
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  p_admin_user_id UUID,
  p_target_user_id UUID,
  p_data_type TEXT,
  p_fields_accessed TEXT[],
  p_access_reason TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'  -- Fixed: Set to specific schema
AS $$
DECLARE
  log_id UUID;
  permission_id UUID;
BEGIN
  -- Find the permission that authorizes this access
  SELECT id INTO permission_id
  FROM public.sensitive_data_permissions
  WHERE admin_user_id = p_admin_user_id
  AND target_user_id = p_target_user_id
  AND permission_type = p_data_type
  AND is_active = true
  AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
  
  -- Log the access
  INSERT INTO public.sensitive_data_access_logs (
    admin_user_id, target_user_id, data_type, fields_accessed, 
    access_reason, permission_id, ip_address, user_agent, session_id
  ) VALUES (
    p_admin_user_id, p_target_user_id, p_data_type, p_fields_accessed,
    p_access_reason, permission_id,
    (current_setting('request.headers', true)::jsonb->>'x-forwarded-for')::inet,
    current_setting('request.headers', true)::jsonb->>'user-agent',
    current_setting('request.jwt.claims', true)::jsonb->>'session_id'
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Fix grant_sensitive_data_permission function
CREATE OR REPLACE FUNCTION public.grant_sensitive_data_permission(
  p_admin_user_id UUID,
  p_target_user_id UUID,
  p_permission_type TEXT,
  p_business_justification TEXT,
  p_expires_hours INTEGER DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'  -- Fixed: Set to specific schema
AS $$
DECLARE
  permission_id UUID;
  granter_role TEXT;
BEGIN
  -- Only super admins can grant permissions
  granter_role := public.get_user_role(auth.uid());
  IF granter_role != 'super_admin' THEN
    RAISE EXCEPTION 'Only super admins can grant sensitive data permissions';
  END IF;
  
  -- Validate that target is actually a user with data
  IF NOT EXISTS (SELECT 1 FROM public.contact_entities WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'Target user has no data to access';
  END IF;
  
  -- Create the permission
  INSERT INTO public.sensitive_data_permissions (
    admin_user_id, target_user_id, permission_type, granted_by,
    business_justification, expires_at
  ) VALUES (
    p_admin_user_id, p_target_user_id, p_permission_type, auth.uid(),
    p_business_justification,
    CASE WHEN p_expires_hours IS NOT NULL THEN now() + (p_expires_hours || ' hours')::interval ELSE NULL END
  ) RETURNING id INTO permission_id;
  
  -- Log the permission grant
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'sensitive_data_permission_granted',
    'high',
    jsonb_build_object(
      'permission_id', permission_id,
      'admin_user_id', p_admin_user_id,
      'target_user_id', p_target_user_id,
      'permission_type', p_permission_type,
      'business_justification', p_business_justification,
      'expires_hours', p_expires_hours
    )
  );
  
  RETURN permission_id;
END;
$$;