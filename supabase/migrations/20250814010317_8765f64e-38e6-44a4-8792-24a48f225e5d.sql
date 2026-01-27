-- CRITICAL SECURITY FIX: Secure access to verified_blockchain_records view
-- The view exposes sensitive blockchain data and needs proper access controls

-- First, check and secure the underlying immutable_audit_trail table if needed
DO $$
BEGIN
    -- Enable RLS on immutable_audit_trail if not already enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'immutable_audit_trail' 
        AND schemaname = 'public' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.immutable_audit_trail ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Drop existing policies on immutable_audit_trail if they exist
DROP POLICY IF EXISTS "Admins can view all audit trail" ON public.immutable_audit_trail;
DROP POLICY IF EXISTS "Users can view their own audit trail" ON public.immutable_audit_trail;

-- Create secure RLS policies for immutable_audit_trail
CREATE POLICY "Admins can manage immutable audit trail"
ON public.immutable_audit_trail
FOR ALL
USING (public.get_user_role() IN ('admin', 'super_admin'))
WITH CHECK (public.get_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Users can view their own immutable audit trail"
ON public.immutable_audit_trail
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  public.get_user_role() IN ('admin', 'super_admin')
);

-- Create a secure replacement function for verified_blockchain_records view access
-- This function provides controlled access to the sensitive blockchain verification data
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
SET search_path = ''
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
    'verified_blockchain_data_access',
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
    RAISE EXCEPTION 'Unauthorized access to verified blockchain data';
  END IF;
  
  -- Return the secured data using the same logic as the original view
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
    AND (p_record_id IS NULL OR br.record_id = p_record_id)
    AND (
      -- Apply the same access control logic
      user_role IN ('admin', 'super_admin')
      OR
      iat.user_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.leads l 
        WHERE l.id::text = br.record_id AND l.user_id = auth.uid()
        UNION
        SELECT 1 FROM public.clients c 
        WHERE c.id::text = br.record_id AND c.user_id = auth.uid()
        UNION
        SELECT 1 FROM public.contact_entities ce 
        WHERE ce.id::text = br.record_id AND ce.user_id = auth.uid()
      )
    );
END;
$$;

-- Create an additional function that provides masked data for non-admin users
CREATE OR REPLACE FUNCTION public.get_verified_blockchain_records_masked(
  p_record_type text DEFAULT NULL,
  p_record_id text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  record_type text,
  record_id text,
  data_hash_masked text,
  blockchain_hash_masked text,
  block_number bigint,
  transaction_hash_masked text,
  verified_at timestamp with time zone,
  verification_status text,
  created_at timestamp with time zone,
  user_id uuid,
  action text,
  audit_verified boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
  is_authorized boolean := false;
BEGIN
  user_role := public.get_user_role();
  
  -- Check if user can access any blockchain data
  IF user_role IN ('admin', 'super_admin') THEN
    is_authorized := true;
  ELSIF p_record_id IS NOT NULL THEN
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
    'verified_blockchain_masked_access',
    'low',
    jsonb_build_object(
      'record_type', p_record_type,
      'record_id', p_record_id,
      'authorized', is_authorized,
      'user_role', user_role,
      'access_method', 'masked_function'
    )
  );
  
  IF NOT is_authorized THEN
    RAISE EXCEPTION 'Unauthorized access to blockchain verification data';
  END IF;
  
  -- Return masked data for non-admin users
  RETURN QUERY
  SELECT 
    br.id,
    br.record_type,
    br.record_id,
    CASE 
      WHEN user_role IN ('admin', 'super_admin') THEN br.data_hash
      ELSE LEFT(br.data_hash, 8) || '...' || RIGHT(br.data_hash, 8)
    END AS data_hash_masked,
    CASE 
      WHEN user_role IN ('admin', 'super_admin') THEN br.blockchain_hash
      ELSE LEFT(br.blockchain_hash, 8) || '...' || RIGHT(br.blockchain_hash, 8)
    END AS blockchain_hash_masked,
    br.block_number,
    CASE 
      WHEN user_role IN ('admin', 'super_admin') THEN br.transaction_hash
      ELSE LEFT(br.transaction_hash, 8) || '...' || RIGHT(br.transaction_hash, 8)
    END AS transaction_hash_masked,
    br.verified_at,
    br.verification_status,
    br.created_at,
    iat.user_id,
    iat.action,
    iat.is_verified AS audit_verified
  FROM public.blockchain_records br
  LEFT JOIN public.immutable_audit_trail iat ON (br.id = iat.blockchain_record_id)
  WHERE br.verification_status = 'verified'
    AND (p_record_type IS NULL OR br.record_type = p_record_type)
    AND (p_record_id IS NULL OR br.record_id = p_record_id)
    AND (
      user_role IN ('admin', 'super_admin')
      OR
      iat.user_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.leads l 
        WHERE l.id::text = br.record_id AND l.user_id = auth.uid()
        UNION
        SELECT 1 FROM public.clients c 
        WHERE c.id::text = br.record_id AND c.user_id = auth.uid()
        UNION
        SELECT 1 FROM public.contact_entities ce 
        WHERE ce.id::text = br.record_id AND ce.user_id = auth.uid()
      )
    );
END;
$$;

-- Create a security alert for any direct access attempts to the view
CREATE OR REPLACE FUNCTION public.log_verified_blockchain_view_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'direct_view_access_attempt',
    'medium',
    jsonb_build_object(
      'view_name', 'verified_blockchain_records',
      'message', 'Direct access to verified_blockchain_records view detected - use secure functions instead',
      'timestamp', now(),
      'user_role', public.get_user_role()
    )
  );
END;
$$;