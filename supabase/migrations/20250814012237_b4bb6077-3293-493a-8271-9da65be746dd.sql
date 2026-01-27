-- Final fix for blockchain records security vulnerability
-- Drop the insecure views and create secure access patterns

-- Drop the existing insecure views
DROP VIEW IF EXISTS public.verified_blockchain_records CASCADE;
DROP VIEW IF EXISTS public.verified_blockchain_records_secure CASCADE;

-- Ensure immutable_audit_trail has proper RLS (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'immutable_audit_trail') THEN
        -- Enable RLS on immutable_audit_trail if not already enabled
        ALTER TABLE public.immutable_audit_trail ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies to avoid conflicts
        DROP POLICY IF EXISTS "Secure immutable audit trail admin access" ON public.immutable_audit_trail;
        DROP POLICY IF EXISTS "Secure immutable audit trail user access" ON public.immutable_audit_trail;
        DROP POLICY IF EXISTS "Secure immutable audit trail system insert" ON public.immutable_audit_trail;
        
        -- Create secure policies
        CREATE POLICY "Secure immutable audit trail admin access" 
        ON public.immutable_audit_trail FOR ALL 
        USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role))
        WITH CHECK (has_role('admin'::user_role) OR has_role('super_admin'::user_role));
        
        CREATE POLICY "Secure immutable audit trail user access" 
        ON public.immutable_audit_trail FOR SELECT 
        USING (validate_blockchain_access(record_id, 'SELECT'::text));
        
        CREATE POLICY "Secure immutable audit trail system insert" 
        ON public.immutable_audit_trail FOR INSERT 
        WITH CHECK (true);
    END IF;
END $$;

-- Create a secure function to access verified blockchain records
CREATE OR REPLACE FUNCTION public.get_verified_blockchain_records_final(
    p_record_type text DEFAULT NULL,
    p_record_id text DEFAULT NULL
)
RETURNS TABLE(
    blockchain_id uuid,
    record_type text,
    record_id text,
    data_hash text,
    blockchain_hash text,
    transaction_hash text,
    verification_status text,
    verified_at timestamp with time zone,
    audit_id uuid,
    user_id uuid,
    action text,
    table_name text,
    old_values_hash text,
    new_values_hash text,
    timestamp_hash text,
    audit_created_at timestamp with time zone
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
    
    -- Authorization check
    IF user_role IN ('admin', 'super_admin') THEN
        is_authorized := true;
    ELSIF p_record_id IS NOT NULL THEN
        -- Users can access records for their own data
        SELECT public.validate_blockchain_access(p_record_id, 'SELECT'::text) INTO is_authorized;
    END IF;
    
    -- Log access attempt
    INSERT INTO public.security_events (
        user_id, event_type, severity, details
    ) VALUES (
        auth.uid(),
        'verified_blockchain_data_access_final',
        CASE WHEN is_authorized THEN 'low' ELSE 'high' END,
        jsonb_build_object(
            'record_type', p_record_type,
            'record_id', p_record_id,
            'user_role', user_role,
            'authorized', is_authorized,
            'access_method', 'secure_function'
        )
    );
    
    -- Block unauthorized access
    IF NOT is_authorized THEN
        RAISE EXCEPTION 'Access denied to verified blockchain records. Insufficient permissions.';
    END IF;
    
    -- Return data based on filters
    RETURN QUERY
    SELECT 
        br.id as blockchain_id,
        br.record_type,
        br.record_id,
        br.data_hash,
        br.blockchain_hash,
        br.transaction_hash,
        br.verification_status,
        br.verified_at,
        iat.id as audit_id,
        iat.user_id,
        iat.action,
        iat.table_name,
        iat.old_values_hash,
        iat.new_values_hash,
        iat.timestamp_hash,
        iat.created_at as audit_created_at
    FROM public.blockchain_records br
    LEFT JOIN public.immutable_audit_trail iat ON (
        br.record_type = iat.table_name AND 
        br.record_id = iat.record_id
    )
    WHERE (p_record_type IS NULL OR br.record_type = p_record_type)
    AND (p_record_id IS NULL OR br.record_id = p_record_id)
    ORDER BY br.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_verified_blockchain_records_final TO authenticated;

-- Log that the critical security fix has been applied
INSERT INTO public.security_events (
    event_type, severity, details
) VALUES (
    'critical_blockchain_security_fix_final',
    'critical',
    jsonb_build_object(
        'action', 'removed_insecure_views_and_created_secure_function',
        'affected_objects', ARRAY['verified_blockchain_records', 'verified_blockchain_records_secure'],
        'security_improvement', 'blockchain_verification_data_fully_secured',
        'access_method', 'secure_function_only'
    )
);