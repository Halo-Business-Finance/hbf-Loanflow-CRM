-- CRITICAL SECURITY FIX: Secure Rate Limiting System
-- Issue: Email addresses exposed in publicly readable rate_limits table

-- 1. Drop the overly permissive policy that allows public access
DROP POLICY IF EXISTS "System can manage rate limits" ON public.rate_limits;

-- 2. Create secure, restrictive policies for rate_limits table

-- Policy 1: Only allow system/service role to INSERT rate limit records
CREATE POLICY "Service role can insert rate limits" ON public.rate_limits
  FOR INSERT 
  TO service_role
  WITH CHECK (true);

-- Policy 2: Only allow system/service role to UPDATE rate limit records  
CREATE POLICY "Service role can update rate limits" ON public.rate_limits
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy 3: Only admins and super_admins can SELECT rate limit data for monitoring
CREATE POLICY "Admins can view rate limits for monitoring" ON public.rate_limits
  FOR SELECT
  USING (
    (auth.uid() IS NOT NULL) AND 
    (has_role('admin'::user_role) OR has_role('super_admin'::user_role))
  );

-- Policy 4: Users can only view their own rate limit status (without sensitive identifiers)
CREATE POLICY "Users can view their own rate limit status" ON public.rate_limits
  FOR SELECT
  USING (
    (auth.uid() IS NOT NULL) AND 
    (identifier = auth.uid()::text)
  );

-- Policy 5: Only service role can DELETE old rate limit records (for cleanup)
CREATE POLICY "Service role can delete rate limits" ON public.rate_limits
  FOR DELETE
  TO service_role
  USING (true);

-- 3. Create a secure function for rate limit checks that doesn't expose sensitive data
CREATE OR REPLACE FUNCTION public.check_user_rate_limit_secure(
  p_action_type text,
  p_max_attempts integer DEFAULT 5,
  p_window_minutes integer DEFAULT 15
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  user_id_str text;
  current_record RECORD;
  is_allowed boolean := true;
  attempts_remaining integer;
BEGIN
  -- Use authenticated user's ID instead of email
  user_id_str := auth.uid()::text;
  
  IF user_id_str IS NULL THEN
    -- For unauthenticated requests, use a generic identifier
    user_id_str := 'anonymous';
  END IF;
  
  -- Get or check rate limit record using user ID, not email
  SELECT * INTO current_record 
  FROM public.rate_limits 
  WHERE identifier = user_id_str AND action_type = p_action_type;
  
  IF FOUND THEN
    -- Check if window has expired
    IF current_record.window_start < (now() - INTERVAL '1 minute' * p_window_minutes) THEN
      -- Reset the window
      UPDATE public.rate_limits 
      SET request_count = 1, 
          window_start = now(), 
          blocked_until = NULL
      WHERE identifier = user_id_str AND action_type = p_action_type;
      attempts_remaining := p_max_attempts - 1;
    ELSE
      -- Increment attempt count
      UPDATE public.rate_limits 
      SET request_count = request_count + 1
      WHERE identifier = user_id_str AND action_type = p_action_type;
      
      attempts_remaining := p_max_attempts - (current_record.request_count + 1);
      
      -- Check if limit exceeded
      IF current_record.request_count + 1 >= p_max_attempts THEN
        UPDATE public.rate_limits 
        SET blocked_until = now() + INTERVAL '1 hour'
        WHERE identifier = user_id_str AND action_type = p_action_type;
        is_allowed := false;
        attempts_remaining := 0;
      END IF;
    END IF;
  ELSE
    -- Create new rate limit record with user ID
    INSERT INTO public.rate_limits (identifier, action_type, request_count, window_start)
    VALUES (user_id_str, p_action_type, 1, now());
    attempts_remaining := p_max_attempts - 1;
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', is_allowed,
    'attempts_remaining', attempts_remaining,
    'reset_time', (now() + INTERVAL '1 minute' * p_window_minutes)
  );
END;
$$;

-- 4. Anonymize existing email addresses in rate_limits table for security
UPDATE public.rate_limits 
SET identifier = 'legacy_' || encode(digest(identifier, 'sha256'), 'hex')
WHERE identifier LIKE '%@%';

-- 5. Log this security fix
INSERT INTO public.security_events (
  event_type, severity, details
) VALUES (
  'rate_limits_security_fix_applied',
  'high',
  jsonb_build_object(
    'description', 'Fixed critical email exposure in rate_limits table',
    'actions_taken', ARRAY[
      'Removed overly permissive policies',
      'Added restrictive RLS policies',
      'Anonymized existing email addresses',
      'Created secure rate limiting function'
    ],
    'timestamp', now()
  )
);