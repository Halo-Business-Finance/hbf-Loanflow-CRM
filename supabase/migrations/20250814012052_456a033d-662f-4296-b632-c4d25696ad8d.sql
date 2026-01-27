-- Enable RLS on the verified_blockchain_records view and create proper security policies
-- Views can have RLS policies in PostgreSQL 14+

-- Enable RLS on the view
ALTER VIEW public.verified_blockchain_records SET (security_barrier = true);

-- Since we can't directly enable RLS on views in all PostgreSQL versions,
-- let's create a secure replacement using a security definer function
-- and then replace the view with a table function or secure access method

-- First, let's create a more comprehensive secure access function that replaces the view
CREATE OR REPLACE FUNCTION public.get_verified_blockchain_records_secure_view(
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
SET search_path = public
AS $$
DECLARE
  user_role text;
  current_user_id uuid;
BEGIN
  -- Get current user info
  current_user_id := auth.uid();
  user_role := public.get_user_role(current_user_id);
  
  -- Log all access attempts to verified blockchain data
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    current_user_id,
    'verified_blockchain_data_access',
    CASE 
      WHEN user_role IN ('admin', 'super_admin') THEN 'low'
      ELSE 'medium'
    END,
    jsonb_build_object(
      'record_type', p_record_type,
      'record_id', p_record_id,
      'user_role', user_role,
      'access_method', 'secure_view_function',
      'timestamp', now()
    )
  );
  
  -- Return filtered results based on user permissions
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
      -- Admins and super admins can see all verified records
      user_role IN ('admin', 'super_admin') OR
      -- Users can only see records they own or are associated with
      iat.user_id = current_user_id OR
      -- Users can see blockchain records for their leads
      (br.record_type = 'lead' AND EXISTS (
        SELECT 1 FROM public.leads l 
        WHERE l.id::text = br.record_id AND l.user_id = current_user_id
      )) OR
      -- Users can see blockchain records for their clients
      (br.record_type = 'client' AND EXISTS (
        SELECT 1 FROM public.clients c 
        WHERE c.id::text = br.record_id AND c.user_id = current_user_id
      )) OR
      -- Users can see blockchain records for their contacts
      (br.record_type = 'contact' AND EXISTS (
        SELECT 1 FROM public.contact_entities ce 
        WHERE ce.id::text = br.record_id AND ce.user_id = current_user_id
      ))
    );
END;
$$;

-- Create a secure materialized view alternative that uses our security function
-- This replaces direct access to the insecure view
CREATE OR REPLACE VIEW public.verified_blockchain_records_secure AS
SELECT * FROM public.get_verified_blockchain_records_secure_view();

-- Grant appropriate permissions to the secure view
GRANT SELECT ON public.verified_blockchain_records_secure TO authenticated;
REVOKE ALL ON public.verified_blockchain_records FROM public;
REVOKE ALL ON public.verified_blockchain_records FROM authenticated;

-- Add a warning comment to the original view
COMMENT ON VIEW public.verified_blockchain_records IS 
'SECURITY WARNING: This view is deprecated due to lack of access controls. Use get_verified_blockchain_records_secure_view() function or verified_blockchain_records_secure view instead for secure access to blockchain verification data.';

-- Log this security enhancement
INSERT INTO public.security_events (
  user_id, event_type, severity, details
) VALUES (
  NULL,
  'security_enhancement_applied',
  'low',
  jsonb_build_object(
    'enhancement_type', 'blockchain_view_security',
    'action', 'created_secure_access_controls',
    'affected_resource', 'verified_blockchain_records',
    'timestamp', now()
  )
);