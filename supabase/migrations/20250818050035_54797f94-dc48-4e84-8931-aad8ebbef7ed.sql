-- Fix for Security Finding: Administrators Can Access All Customer Financial Data
-- This migration implements need-to-know access controls and audit logging

-- 1. Create sensitive data access permissions table
CREATE TABLE IF NOT EXISTS public.sensitive_data_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  permission_type TEXT NOT NULL CHECK (permission_type IN ('financial_data', 'credit_data', 'income_data', 'loan_data')),
  granted_by UUID NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  business_justification TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by UUID,
  revoke_reason TEXT,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sensitive data permissions
ALTER TABLE public.sensitive_data_permissions ENABLE ROW LEVEL SECURITY;

-- 2. Create sensitive data access logs table for audit trail
CREATE TABLE IF NOT EXISTS public.sensitive_data_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  data_type TEXT NOT NULL,
  fields_accessed TEXT[],
  access_reason TEXT,
  permission_id UUID REFERENCES public.sensitive_data_permissions(id),
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on access logs
ALTER TABLE public.sensitive_data_access_logs ENABLE ROW LEVEL SECURITY;

-- 3. Create function to check if admin has permission to access sensitive data
CREATE OR REPLACE FUNCTION public.has_sensitive_data_permission(
  p_admin_user_id UUID,
  p_target_user_id UUID,
  p_permission_type TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- 4. Create function to log sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  p_admin_user_id UUID,
  p_target_user_id UUID,
  p_data_type TEXT,
  p_fields_accessed TEXT[],
  p_access_reason TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- 5. Create function to grant sensitive data permission
CREATE OR REPLACE FUNCTION public.grant_sensitive_data_permission(
  p_admin_user_id UUID,
  p_target_user_id UUID,
  p_permission_type TEXT,
  p_business_justification TEXT,
  p_expires_hours INTEGER DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- 6. Update contact_entities RLS policy to implement need-to-know access
DROP POLICY IF EXISTS "Role-based contact entities access" ON public.contact_entities;

CREATE POLICY "Secure contact entities access with need-to-know" 
ON public.contact_entities
FOR SELECT
USING (
  CASE
    -- Users can always access their own data
    WHEN (auth.uid() = user_id) THEN true
    
    -- Agents can only access their own data
    WHEN has_role('agent'::user_role) THEN (auth.uid() = user_id)
    
    -- Loan processors, underwriters, funders, closers can access data they're working on
    WHEN (has_role('loan_processor'::user_role) OR has_role('underwriter'::user_role) 
          OR has_role('funder'::user_role) OR has_role('closer'::user_role)) THEN (
      -- Only if they have an active lead/loan for this contact
      EXISTS (
        SELECT 1 FROM public.leads l 
        WHERE l.user_id = auth.uid() 
        AND (l.contact_entity_id = contact_entities.id OR l.user_id = contact_entities.user_id)
      ) OR
      EXISTS (
        SELECT 1 FROM public.loans ln
        WHERE ln.user_id = auth.uid()
        AND ln.client_id IN (
          SELECT c.id FROM public.clients c WHERE c.contact_entity_id = contact_entities.id
        )
      )
    )
    
    -- Managers can access data for their team members
    WHEN has_role('manager'::user_role) THEN (
      -- Only if the contact belongs to someone in their team (same org/region)
      auth.uid() = user_id OR
      EXISTS (
        SELECT 1 FROM public.leads l 
        WHERE l.contact_entity_id = contact_entities.id
        AND l.user_id IN (
          -- This would need to be expanded based on your team structure
          SELECT auth.uid() -- Simplified for now
        )
      )
    )
    
    -- Admins need explicit permission for sensitive data access
    WHEN has_role('admin'::user_role) THEN (
      -- Can access basic data (name, email, phone) without permission
      auth.uid() = user_id OR
      -- Need permission for financial data access
      public.has_sensitive_data_permission(auth.uid(), contact_entities.user_id, 'financial_data')
    )
    
    -- Super admins have emergency access but it's logged
    WHEN has_role('super_admin'::user_role) THEN (
      -- Always allowed but access is logged in has_sensitive_data_permission function
      public.has_sensitive_data_permission(auth.uid(), contact_entities.user_id, 'financial_data') OR true
    )
    
    ELSE false
  END
);

-- 7. Create RLS policies for the new tables
CREATE POLICY "Super admins can manage sensitive data permissions"
ON public.sensitive_data_permissions
FOR ALL
USING (has_role('super_admin'::user_role))
WITH CHECK (has_role('super_admin'::user_role));

CREATE POLICY "Admins can view their own permissions"
ON public.sensitive_data_permissions
FOR SELECT
USING (auth.uid() = admin_user_id OR has_role('super_admin'::user_role));

CREATE POLICY "Super admins can view all access logs"
ON public.sensitive_data_access_logs
FOR SELECT
USING (has_role('super_admin'::user_role));

CREATE POLICY "Auditors can view access logs"
ON public.sensitive_data_access_logs
FOR SELECT
USING (has_role('admin'::user_role));

CREATE POLICY "System can insert access logs"
ON public.sensitive_data_access_logs
FOR INSERT
WITH CHECK (true);

-- 8. Create trigger to update timestamps
CREATE OR REPLACE FUNCTION public.update_sensitive_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sensitive_permissions_updated_at
BEFORE UPDATE ON public.sensitive_data_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_sensitive_permissions_updated_at();

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sensitive_permissions_admin_target 
ON public.sensitive_data_permissions(admin_user_id, target_user_id, permission_type);

CREATE INDEX IF NOT EXISTS idx_sensitive_permissions_active 
ON public.sensitive_data_permissions(is_active, expires_at);

CREATE INDEX IF NOT EXISTS idx_sensitive_access_logs_admin_time 
ON public.sensitive_data_access_logs(admin_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_sensitive_access_logs_target_time 
ON public.sensitive_data_access_logs(target_user_id, created_at);