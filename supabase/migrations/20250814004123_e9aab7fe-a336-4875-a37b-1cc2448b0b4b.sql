-- Fix Blockchain Verification Data Security
-- Issue: verified_blockchain_records view has no RLS protection
-- Solution: Create secure access function and enhance underlying table security

-- 1. Enable RLS on immutable_audit_trail table (used in the view)
ALTER TABLE public.immutable_audit_trail ENABLE ROW LEVEL SECURITY;

-- 2. Create admin-only access policies for immutable_audit_trail
CREATE POLICY "Admins can view immutable audit trail"
ON public.immutable_audit_trail
FOR SELECT
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "Admins can insert into immutable audit trail"
ON public.immutable_audit_trail
FOR INSERT
WITH CHECK (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- 3. Create secure function to access verified blockchain records with proper validation
CREATE OR REPLACE FUNCTION public.get_verified_blockchain_records_secure(
  p_record_type text DEFAULT NULL,
  p_record_id text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  record_type text,
  record_id text,
  data_hash text,
  blockchain_hash text,
  block_number bigint,
  transaction_hash text,
  verified_at timestamp with time zone,
  verification_status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  metadata jsonb,
  user_id uuid,
  action text,
  audit_verified boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  user_role text;
  is_authorized boolean := false;
BEGIN
  -- Get user role
  user_role := public.get_user_role();
  
  -- Check authorization
  IF user_role IN ('admin', 'super_admin') THEN
    is_authorized := true;
  ELSIF p_record_id IS NOT NULL THEN
    -- Users can access blockchain records for their own data
    SELECT EXISTS (
      SELECT 1 FROM public.leads l 
      WHERE l.id::text = p_record_id AND l.user_id = auth.uid()
      UNION
      SELECT 1 FROM public.clients c 
      WHERE c.id::text = p_record_id AND c.user_id = auth.uid()
      UNION
      SELECT 1 FROM public.contact_entities ce 
      WHERE ce.id::text = p_record_id AND ce.user_id = auth.uid()
    ) INTO is_authorized;
  END IF;
  
  -- Log access attempt
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'blockchain_verification_access',
    CASE WHEN is_authorized THEN 'low' ELSE 'high' END,
    jsonb_build_object(
      'record_type', p_record_type,
      'record_id', p_record_id,
      'authorized', is_authorized,
      'user_role', user_role,
      'access_method', 'secure_function'
    )
  );
  
  -- Return data only if authorized
  IF NOT is_authorized THEN
    RAISE EXCEPTION 'Unauthorized access to blockchain verification data';
  END IF;
  
  RETURN QUERY
  SELECT 
    br.id,
    br.record_type,
    br.record_id,
    br.data_hash,
    br.blockchain_hash,
    br.block_number,
    br.transaction_hash,
    br.verified_at,
    br.verification_status,
    br.created_at,
    br.updated_at,
    br.metadata,
    iat.user_id,
    iat.action,
    iat.is_verified AS audit_verified
  FROM public.blockchain_records br
  LEFT JOIN public.immutable_audit_trail iat ON (br.id = iat.blockchain_record_id)
  WHERE br.verification_status = 'verified'
    AND (p_record_type IS NULL OR br.record_type = p_record_type)
    AND (p_record_id IS NULL OR br.record_id = p_record_id);
END;
$$;

-- 4. Add security validation trigger to blockchain_records
CREATE OR REPLACE FUNCTION public.validate_blockchain_record_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Validate access for sensitive operations
  IF TG_OP = 'DELETE' AND NOT has_role('super_admin'::user_role) THEN
    INSERT INTO public.security_events (
      user_id, event_type, severity, details
    ) VALUES (
      auth.uid(),
      'unauthorized_blockchain_deletion_attempt',
      'critical',
      jsonb_build_object(
        'record_id', OLD.id,
        'record_type', OLD.record_type,
        'user_role', public.get_user_role()
      )
    );
    RAISE EXCEPTION 'Unauthorized deletion of blockchain record';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply trigger to blockchain_records
DROP TRIGGER IF EXISTS validate_blockchain_access_trigger ON public.blockchain_records;
CREATE TRIGGER validate_blockchain_access_trigger
  BEFORE DELETE ON public.blockchain_records
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_blockchain_record_access();

-- 5. Create comprehensive security validation function
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
  user_role text;
  is_authorized boolean := false;
  access_level text;
BEGIN
  user_role := public.get_user_role();
  
  -- Determine access level based on role
  CASE user_role
    WHEN 'super_admin' THEN
      is_authorized := true;
      access_level := 'full';
    WHEN 'admin' THEN
      is_authorized := (p_operation IN ('SELECT', 'INSERT', 'UPDATE'));
      access_level := 'limited';
    WHEN 'manager' THEN
      is_authorized := (p_operation = 'SELECT');
      access_level := 'read_only';
    ELSE
      -- Standard users need ownership validation
      IF p_record_id IS NOT NULL AND p_operation = 'SELECT' THEN
        SELECT EXISTS (
          SELECT 1 FROM public.leads l 
          WHERE l.id::text = p_record_id AND l.user_id = auth.uid()
          UNION
          SELECT 1 FROM public.clients c 
          WHERE c.id::text = p_record_id AND c.user_id = auth.uid()
        ) INTO is_authorized;
        access_level := 'owned_only';
      END IF;
  END CASE;
  
  -- Log access validation
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'sensitive_table_access_validation',
    CASE WHEN is_authorized THEN 'low' ELSE 'medium' END,
    jsonb_build_object(
      'table_name', p_table_name,
      'operation', p_operation,
      'record_id', p_record_id,
      'user_role', user_role,
      'access_level', access_level,
      'authorized', is_authorized
    )
  );
  
  RETURN is_authorized;
END;
$$;