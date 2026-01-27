-- CRITICAL SECURITY FIX: Secure verified_blockchain_records table
-- This table contains sensitive blockchain verification data and currently has NO RLS policies

-- Enable Row Level Security on verified_blockchain_records table
ALTER TABLE public.verified_blockchain_records ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies for verified_blockchain_records

-- 1. Admin and Super Admin access - Full access to all records
CREATE POLICY "Admins can manage all verified blockchain records"
ON public.verified_blockchain_records
FOR ALL
USING (public.get_user_role() IN ('admin', 'super_admin'))
WITH CHECK (public.get_user_role() IN ('admin', 'super_admin'));

-- 2. Users can view verified blockchain records for their own data only
CREATE POLICY "Users can view their own verified blockchain records"
ON public.verified_blockchain_records
FOR SELECT
USING (
  -- User can access records for their own data
  user_id = auth.uid()
  OR
  -- User can access blockchain records for data they own
  EXISTS (
    SELECT 1 FROM public.leads l 
    WHERE l.id::text = verified_blockchain_records.record_id 
    AND l.user_id = auth.uid()
    UNION
    SELECT 1 FROM public.clients c 
    WHERE c.id::text = verified_blockchain_records.record_id 
    AND c.user_id = auth.uid()
    UNION
    SELECT 1 FROM public.contact_entities ce 
    WHERE ce.id::text = verified_blockchain_records.record_id 
    AND ce.user_id = auth.uid()
  )
);

-- 3. System can insert verification records (for automated verification processes)
CREATE POLICY "System can create verified blockchain records"
ON public.verified_blockchain_records
FOR INSERT
WITH CHECK (
  -- Only allow creation if the record being verified belongs to the user
  EXISTS (
    SELECT 1 FROM public.leads l 
    WHERE l.id::text = verified_blockchain_records.record_id 
    AND l.user_id = auth.uid()
    UNION
    SELECT 1 FROM public.clients c 
    WHERE c.id::text = verified_blockchain_records.record_id 
    AND c.user_id = auth.uid()
    UNION
    SELECT 1 FROM public.contact_entities ce 
    WHERE ce.id::text = verified_blockchain_records.record_id 
    AND ce.user_id = auth.uid()
  )
  OR
  -- Or if user is admin/super_admin
  public.get_user_role() IN ('admin', 'super_admin')
);

-- 4. Only admins can update verification records (to prevent tampering)
CREATE POLICY "Only admins can update verified blockchain records"
ON public.verified_blockchain_records
FOR UPDATE
USING (public.get_user_role() IN ('admin', 'super_admin'))
WITH CHECK (public.get_user_role() IN ('admin', 'super_admin'));

-- 5. Only super admins can delete verification records (ultimate protection)
CREATE POLICY "Only super admins can delete verified blockchain records"
ON public.verified_blockchain_records
FOR DELETE
USING (public.get_user_role() = 'super_admin');

-- Create comprehensive audit logging for verified blockchain records access
CREATE OR REPLACE FUNCTION public.audit_verified_blockchain_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
  severity_level text;
BEGIN
  user_role := public.get_user_role();
  
  -- Determine severity based on operation and user role
  severity_level := CASE 
    WHEN TG_OP = 'DELETE' THEN 'critical'
    WHEN TG_OP = 'UPDATE' THEN 'high'
    WHEN user_role NOT IN ('admin', 'super_admin') THEN 'medium'
    ELSE 'low'
  END;
  
  -- Log all access to verified blockchain records
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'verified_blockchain_access',
    severity_level,
    jsonb_build_object(
      'operation', TG_OP,
      'table_name', TG_TABLE_NAME,
      'record_id', COALESCE(NEW.id, OLD.id),
      'blockchain_record_id', COALESCE(NEW.record_id, OLD.record_id),
      'verification_status', COALESCE(NEW.verification_status, OLD.verification_status),
      'user_role', user_role,
      'timestamp', now(),
      'transaction_hash', COALESCE(NEW.transaction_hash, OLD.transaction_hash)
    )
  );
  
  -- Also log to audit_logs for compliance
  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, 
    old_values, new_values
  ) VALUES (
    auth.uid(),
    TG_OP || '_verified_blockchain_record',
    'verified_blockchain_records',
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply audit trigger to verified_blockchain_records
DROP TRIGGER IF EXISTS audit_verified_blockchain_access ON public.verified_blockchain_records;
CREATE TRIGGER audit_verified_blockchain_access
  AFTER INSERT OR UPDATE OR DELETE ON public.verified_blockchain_records
  FOR EACH ROW EXECUTE FUNCTION public.audit_verified_blockchain_access();

-- Create security function for safe access to verified blockchain records
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
  
  RETURN QUERY
  SELECT 
    vbr.id,
    vbr.record_type,
    vbr.record_id,
    vbr.data_hash,
    vbr.blockchain_hash,
    vbr.block_number,
    vbr.transaction_hash,
    vbr.verified_at,
    vbr.verification_status,
    vbr.created_at,
    vbr.updated_at,
    vbr.metadata,
    vbr.user_id,
    vbr.action,
    vbr.audit_verified
  FROM public.verified_blockchain_records vbr
  WHERE vbr.verification_status = 'verified'
    AND (p_record_type IS NULL OR vbr.record_type = p_record_type)
    AND (p_record_id IS NULL OR vbr.record_id = p_record_id);
END;
$$;