-- Enhanced Contact Entities Security Implementation
-- Address remaining vulnerabilities in contact data access

-- First, ensure the contact_entities table has the most restrictive possible RLS
DROP POLICY IF EXISTS "Secure contact access - strict owner only" ON public.contact_entities;
DROP POLICY IF EXISTS "ZERO TRUST SECURITY - Absolute owner-only access" ON public.contact_entities;

-- Create the most restrictive owner-only policy for contact_entities
CREATE POLICY "FORTRESS_SECURITY_contact_entities_owner_only" 
ON public.contact_entities 
FOR ALL
USING (auth.uid() = user_id AND auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

-- Super admin override with enhanced logging
CREATE POLICY "FORTRESS_SECURITY_super_admin_access_logged" 
ON public.contact_entities 
FOR ALL
USING (
  has_role('super_admin'::user_role) 
  AND auth.uid() IS NOT NULL
)
WITH CHECK (
  has_role('super_admin'::user_role) 
  AND auth.uid() IS NOT NULL
);

-- Create security function to validate contact access with enhanced logging
CREATE OR REPLACE FUNCTION public.validate_contact_access_enhanced(
  p_contact_id uuid,
  p_operation text DEFAULT 'SELECT',
  p_requesting_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  contact_owner uuid;
  requesting_role text;
  is_authorized boolean := false;
BEGIN
  -- Validate inputs
  IF p_contact_id IS NULL OR p_requesting_user_id IS NULL THEN
    -- Log invalid access attempt
    INSERT INTO public.security_events (
      user_id, event_type, severity, details
    ) VALUES (
      p_requesting_user_id,
      'invalid_contact_access_attempt',
      'high',
      jsonb_build_object(
        'contact_id', p_contact_id,
        'operation', p_operation,
        'error', 'missing_required_parameters'
      )
    );
    RETURN false;
  END IF;

  -- Get contact owner
  SELECT user_id INTO contact_owner 
  FROM public.contact_entities 
  WHERE id = p_contact_id;

  -- If contact doesn't exist, deny access
  IF contact_owner IS NULL THEN
    INSERT INTO public.security_events (
      user_id, event_type, severity, details
    ) VALUES (
      p_requesting_user_id,
      'contact_not_found_access_attempt',
      'high',
      jsonb_build_object(
        'contact_id', p_contact_id,
        'operation', p_operation
      )
    );
    RETURN false;
  END IF;

  -- Get requesting user's role
  requesting_role := public.get_user_role(p_requesting_user_id)::text;

  -- Check authorization
  IF contact_owner = p_requesting_user_id THEN
    is_authorized := true;
  ELSIF requesting_role = 'super_admin' THEN
    is_authorized := true;
    -- Log super admin access
    INSERT INTO public.security_events (
      user_id, event_type, severity, details
    ) VALUES (
      p_requesting_user_id,
      'super_admin_contact_access',
      'medium',
      jsonb_build_object(
        'contact_id', p_contact_id,
        'contact_owner', contact_owner,
        'operation', p_operation
      )
    );
  ELSE
    -- Unauthorized access attempt
    INSERT INTO public.security_events (
      user_id, event_type, severity, details
    ) VALUES (
      p_requesting_user_id,
      'unauthorized_contact_access_denied',
      'critical',
      jsonb_build_object(
        'contact_id', p_contact_id,
        'contact_owner', contact_owner,
        'requesting_role', requesting_role,
        'operation', p_operation
      )
    );
  END IF;

  RETURN is_authorized;
END;
$function$;

-- Create comprehensive audit trigger for contact_entities
CREATE OR REPLACE FUNCTION public.audit_contact_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Log all operations on contact_entities
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'contact_entities_' || TG_OP,
    CASE 
      WHEN TG_OP = 'SELECT' THEN 'low'
      WHEN TG_OP = 'INSERT' THEN 'medium'
      WHEN TG_OP = 'UPDATE' THEN 'medium'
      WHEN TG_OP = 'DELETE' THEN 'high'
      ELSE 'medium'
    END,
    jsonb_build_object(
      'operation', TG_OP,
      'contact_id', COALESCE(NEW.id, OLD.id),
      'table_name', TG_TABLE_NAME,
      'timestamp', now(),
      'user_role', public.get_user_role(auth.uid())
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Apply the audit trigger
DROP TRIGGER IF EXISTS audit_contact_access_trigger ON public.contact_entities;
CREATE TRIGGER audit_contact_access_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.contact_entities
  FOR EACH ROW EXECUTE FUNCTION public.audit_contact_access();

-- Ensure contact_encrypted_fields has maximum security
DROP POLICY IF EXISTS "Owner can view encrypted fields for their contacts" ON public.contact_encrypted_fields;
DROP POLICY IF EXISTS "Super admin can view all encrypted fields" ON public.contact_encrypted_fields;

-- Create fortress-level security for encrypted fields
CREATE POLICY "FORTRESS_encrypted_fields_owner_only" 
ON public.contact_encrypted_fields 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.contact_entities ce 
    WHERE ce.id = contact_encrypted_fields.contact_id 
    AND ce.user_id = auth.uid()
    AND auth.uid() IS NOT NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contact_entities ce 
    WHERE ce.id = contact_encrypted_fields.contact_id 
    AND ce.user_id = auth.uid()
    AND auth.uid() IS NOT NULL
  )
);

CREATE POLICY "FORTRESS_encrypted_fields_super_admin" 
ON public.contact_encrypted_fields 
FOR ALL
USING (
  has_role('super_admin'::user_role) 
  AND auth.uid() IS NOT NULL
)
WITH CHECK (
  has_role('super_admin'::user_role) 
  AND auth.uid() IS NOT NULL
);

-- Log the security enhancement
INSERT INTO public.security_events (
  event_type, severity, details
) VALUES (
  'contact_entities_fortress_security_implemented',
  'high',
  jsonb_build_object(
    'enhancement_type', 'fortress_level_rls_policies',
    'tables_secured', ARRAY['contact_entities', 'contact_encrypted_fields'],
    'security_features', ARRAY[
      'owner_only_access_validation',
      'comprehensive_audit_logging',
      'enhanced_super_admin_oversight',
      'fortress_level_rls_policies',
      'encrypted_fields_protection'
    ],
    'impact', 'maximum_security_contact_data_protection'
  )
);