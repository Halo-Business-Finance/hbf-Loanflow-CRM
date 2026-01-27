-- Column-level security for profiles table
-- Create a view that shows only non-sensitive fields for standard access
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  id,
  first_name,
  last_name,
  job_title,
  city,
  state,
  language,
  timezone,
  is_active,
  created_at,
  updated_at
FROM public.profiles;

-- Grant SELECT on public view to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;

-- Create a secure function for accessing sensitive profile fields
CREATE OR REPLACE FUNCTION public.get_profile_sensitive_fields(profile_id uuid)
RETURNS TABLE (
  email text,
  phone_number text,
  email_verified_at timestamp with time zone,
  phone_verified_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    email,
    phone_number,
    email_verified_at,
    phone_verified_at
  FROM profiles
  WHERE id = profile_id
  AND (
    -- User can access own sensitive data
    auth.uid() = id
    OR
    -- Admins can access all sensitive data
    has_role('super_admin'::user_role)
    OR
    has_role('admin'::user_role)
  );
$$;

-- Log access to sensitive fields
CREATE OR REPLACE FUNCTION public.log_sensitive_field_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log when sensitive fields are accessed
  IF (OLD.email IS DISTINCT FROM NEW.email) OR 
     (OLD.phone_number IS DISTINCT FROM NEW.phone_number) THEN
    INSERT INTO security_events (
      user_id,
      event_type,
      severity,
      details,
      ip_address
    ) VALUES (
      auth.uid(),
      'sensitive_field_update',
      'medium',
      jsonb_build_object(
        'profile_id', NEW.id,
        'fields_changed', ARRAY['email', 'phone_number'],
        'timestamp', now()
      ),
      inet_client_addr()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for sensitive field access logging
DROP TRIGGER IF EXISTS log_profile_sensitive_access ON public.profiles;
CREATE TRIGGER log_profile_sensitive_access
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (
    OLD.email IS DISTINCT FROM NEW.email OR 
    OLD.phone_number IS DISTINCT FROM NEW.phone_number OR
    OLD.phone_verification_code IS DISTINCT FROM NEW.phone_verification_code
  )
  EXECUTE FUNCTION public.log_sensitive_field_access();

-- Create a security pattern detection function
CREATE OR REPLACE FUNCTION public.detect_suspicious_patterns()
RETURNS TABLE (
  pattern_type text,
  severity text,
  count bigint,
  description text,
  affected_users uuid[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Multiple failed login attempts (brute force)
  SELECT 
    'brute_force_attempt'::text as pattern_type,
    'high'::text as severity,
    COUNT(*)::bigint as count,
    'Multiple failed login attempts detected'::text as description,
    ARRAY_AGG(DISTINCT user_id) as affected_users
  FROM security_events
  WHERE event_type = 'failed_login'
    AND created_at > now() - interval '15 minutes'
  HAVING COUNT(*) >= 3
  
  UNION ALL
  
  -- Unusual access patterns (access from multiple IPs)
  SELECT 
    'unusual_access_pattern'::text,
    'medium'::text,
    COUNT(DISTINCT ip_address)::bigint,
    'User accessing from multiple IP addresses'::text,
    ARRAY_AGG(DISTINCT user_id)
  FROM security_events
  WHERE created_at > now() - interval '1 hour'
  GROUP BY user_id
  HAVING COUNT(DISTINCT ip_address) >= 3
  
  UNION ALL
  
  -- Mass data access (potential data exfiltration)
  SELECT 
    'mass_data_access'::text,
    'critical'::text,
    COUNT(*)::bigint,
    'Excessive data access detected'::text,
    ARRAY_AGG(DISTINCT user_id)
  FROM audit_logs
  WHERE action = 'SELECT'
    AND created_at > now() - interval '10 minutes'
  GROUP BY user_id
  HAVING COUNT(*) >= 50
  
  UNION ALL
  
  -- Privilege escalation attempts
  SELECT 
    'privilege_escalation'::text,
    'critical'::text,
    COUNT(*)::bigint,
    'Unauthorized privilege escalation attempts'::text,
    ARRAY_AGG(DISTINCT user_id)
  FROM security_events
  WHERE event_type IN ('unauthorized_access', 'permission_denied', 'role_change_attempt')
    AND created_at > now() - interval '30 minutes'
  HAVING COUNT(*) >= 2
  
  UNION ALL
  
  -- Suspicious SQL patterns in audit logs
  SELECT 
    'sql_injection_attempt'::text,
    'critical'::text,
    COUNT(*)::bigint,
    'Potential SQL injection attempts detected'::text,
    ARRAY_AGG(DISTINCT user_id)
  FROM security_events
  WHERE event_type = 'input_validation_failure'
    AND details::text ILIKE '%DROP%'
    OR details::text ILIKE '%UNION%'
    OR details::text ILIKE '%---%'
    AND created_at > now() - interval '1 hour'
  HAVING COUNT(*) >= 1;
$$;

-- Create a table to store detected security patterns
CREATE TABLE IF NOT EXISTS public.security_pattern_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type text NOT NULL,
  severity text NOT NULL,
  detection_count integer NOT NULL,
  description text NOT NULL,
  affected_user_ids uuid[] NOT NULL,
  detected_at timestamp with time zone NOT NULL DEFAULT now(),
  acknowledged boolean DEFAULT false,
  acknowledged_by uuid,
  acknowledged_at timestamp with time zone,
  resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  resolution_notes text
);

-- Enable RLS on security_pattern_alerts
ALTER TABLE public.security_pattern_alerts ENABLE ROW LEVEL SECURITY;

-- Only super admins can view security pattern alerts
CREATE POLICY "Super admins can view security pattern alerts"
ON public.security_pattern_alerts
FOR SELECT
USING (has_role('super_admin'::user_role) OR has_role('admin'::user_role));

-- Only super admins can update alerts
CREATE POLICY "Super admins can update security pattern alerts"
ON public.security_pattern_alerts
FOR UPDATE
USING (has_role('super_admin'::user_role) OR has_role('admin'::user_role));

-- System can insert alerts
CREATE POLICY "System can insert security pattern alerts"
ON public.security_pattern_alerts
FOR INSERT
WITH CHECK (true);

COMMENT ON TABLE public.security_pattern_alerts IS 'Stores detected suspicious security patterns from audit_logs and security_events for real-time threat detection';