-- Fix infinite recursion in opportunities and opportunity_splits RLS policies
-- The issue is circular references between the tables in their policies

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Users can view opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can view relevant opportunity splits" ON public.opportunity_splits;

-- Create security definer functions to break the circular reference
CREATE OR REPLACE FUNCTION public.user_owns_opportunity(opportunity_id uuid, user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.opportunities 
    WHERE id = opportunity_id 
    AND (primary_owner_id = user_id OR created_by = user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_opportunity_split(opportunity_id uuid, user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.opportunity_splits 
    WHERE opportunity_splits.opportunity_id = user_has_opportunity_split.opportunity_id 
    AND opportunity_splits.user_id = user_id
  );
$$;

-- Recreate policies without circular references
CREATE POLICY "Users can view opportunities" ON public.opportunities
FOR SELECT USING (
  (auth.uid() = primary_owner_id) OR 
  (auth.uid() = created_by) OR 
  public.user_has_opportunity_split(id) OR 
  has_role('admin'::user_role)
);

CREATE POLICY "Users can view relevant opportunity splits" ON public.opportunity_splits
FOR SELECT USING (
  (auth.uid() = user_id) OR 
  (auth.uid() = created_by) OR 
  public.user_owns_opportunity(opportunity_id) OR 
  has_role('admin'::user_role)
);

-- Verify blockchain security is properly maintained with a secure access function
-- This function ensures only authorized users can access verified blockchain records
CREATE OR REPLACE FUNCTION public.get_verified_blockchain_records_safe(
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
  is_authorized boolean := false;
BEGIN
  -- Get user role
  user_role := public.get_user_role();
  
  -- Log access attempt for security monitoring
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'verified_blockchain_data_access',
    CASE 
      WHEN user_role IN ('admin', 'super_admin') THEN 'low'
      ELSE 'medium'
    END,
    jsonb_build_object(
      'record_type', p_record_type,
      'record_id', p_record_id,
      'user_role', user_role,
      'access_method', 'secure_function'
    )
  );
  
  -- Check authorization
  IF user_role IN ('admin', 'super_admin') THEN
    is_authorized := true;
  ELSE
    -- Users can only access records for their own data
    is_authorized := EXISTS (
      SELECT 1 FROM public.blockchain_records br
      LEFT JOIN public.immutable_audit_trail iat ON br.id = iat.blockchain_record_id
      WHERE br.verification_status = 'verified'
        AND (p_record_type IS NULL OR br.record_type = p_record_type)
        AND (p_record_id IS NULL OR br.record_id = p_record_id)
        AND (
          iat.user_id = auth.uid() OR
          (br.record_type = 'lead' AND EXISTS (
            SELECT 1 FROM public.leads l 
            WHERE l.id::text = br.record_id AND l.user_id = auth.uid()
          )) OR
          (br.record_type = 'client' AND EXISTS (
            SELECT 1 FROM public.clients c 
            WHERE c.id::text = br.record_id AND c.user_id = auth.uid()
          )) OR
          (br.record_type = 'contact' AND EXISTS (
            SELECT 1 FROM public.contact_entities ce 
            WHERE ce.id::text = br.record_id AND ce.user_id = auth.uid()
          ))
        )
    );
  END IF;
  
  -- Return data only if authorized
  IF NOT is_authorized THEN
    -- Log unauthorized access attempt
    INSERT INTO public.security_events (
      user_id, event_type, severity, details
    ) VALUES (
      auth.uid(),
      'unauthorized_blockchain_access',
      'high',
      jsonb_build_object(
        'record_type', p_record_type,
        'record_id', p_record_id,
        'user_role', user_role,
        'blocked_reason', 'insufficient_permissions'
      )
    );
    RETURN;
  END IF;
  
  -- Return the secured data
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
  LEFT JOIN public.immutable_audit_trail iat ON br.id = iat.blockchain_record_id
  WHERE br.verification_status = 'verified'
    AND (p_record_type IS NULL OR br.record_type = p_record_type)
    AND (p_record_id IS NULL OR br.record_id = p_record_id)
    AND (
      user_role IN ('admin', 'super_admin') OR
      iat.user_id = auth.uid() OR
      (br.record_type = 'lead' AND EXISTS (
        SELECT 1 FROM public.leads l 
        WHERE l.id::text = br.record_id AND l.user_id = auth.uid()
      )) OR
      (br.record_type = 'client' AND EXISTS (
        SELECT 1 FROM public.clients c 
        WHERE c.id::text = br.record_id AND c.user_id = auth.uid()
      )) OR
      (br.record_type = 'contact' AND EXISTS (
        SELECT 1 FROM public.contact_entities ce 
        WHERE ce.id::text = br.record_id AND ce.user_id = auth.uid()
      ))
    );
END;
$$;