-- 1) Make lead-documents bucket private
update storage.buckets set public = false where id = 'lead-documents';

-- 2) Replace storage RLS policies for lead-documents bucket
-- Drop existing policies with same names if they exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Lead docs: users can read own') THEN
    DROP POLICY "Lead docs: users can read own" ON storage.objects;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Lead docs: users can upload to own') THEN
    DROP POLICY "Lead docs: users can upload to own" ON storage.objects;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Lead docs: users can update own') THEN
    DROP POLICY "Lead docs: users can update own" ON storage.objects;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Lead docs: users can delete own') THEN
    DROP POLICY "Lead docs: users can delete own" ON storage.objects;
  END IF;
END $$;

-- Create policies
CREATE POLICY "Lead docs: users can read own" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'lead-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Lead docs: users can upload to own" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'lead-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Lead docs: users can update own" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'lead-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'lead-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Lead docs: users can delete own" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'lead-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3) Strengthen session validation to support encrypted tokens too
CREATE OR REPLACE FUNCTION public.validate_session_with_security_checks(
  p_user_id uuid,
  p_session_token text,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  session_record RECORD;
  config_record RECORD;
  is_valid boolean := false;
  reason text := 'Session validation failed';
  risk_score integer := 0;
  security_flags jsonb := '[]'::jsonb;
BEGIN
  -- Get session config
  SELECT * INTO config_record FROM public.session_config LIMIT 1;
  
  -- Get active session; support plaintext or encrypted storage of token
  SELECT * INTO session_record
  FROM public.active_sessions 
  WHERE user_id = p_user_id 
    AND is_active = true
    AND (
      session_token = p_session_token
      OR public.decrypt_token(session_token) = p_session_token
    )
  LIMIT 1;
  
  IF FOUND THEN
    -- Check if session has expired
    IF session_record.expires_at > now() THEN
      -- Check if last activity is within timeout
      IF session_record.last_activity > (now() - INTERVAL '1 minute' * config_record.session_timeout_minutes) THEN
        -- Additional security checks
        IF p_ip_address IS NOT NULL AND session_record.ip_address IS NOT NULL 
           AND session_record.ip_address != p_ip_address THEN
          risk_score := risk_score + 30;
          security_flags := security_flags || '"ip_change"'::jsonb;
        END IF;
        
        IF p_user_agent IS NOT NULL AND session_record.user_agent IS NOT NULL 
           AND session_record.user_agent != p_user_agent THEN
          risk_score := risk_score + 20;
          security_flags := security_flags || '"user_agent_change"'::jsonb;
        END IF;
        
        IF session_record.last_activity < (now() - INTERVAL '1 hour') THEN
          risk_score := risk_score + 10;
          security_flags := security_flags || '"long_inactive"'::jsonb;
        END IF;
        
        IF risk_score < 50 THEN
          is_valid := true;
          reason := 'Session valid';
          
          -- Update last activity and security info
          UPDATE public.active_sessions 
          SET 
            last_activity = now(),
            ip_address = COALESCE(p_ip_address, ip_address),
            user_agent = COALESCE(p_user_agent, user_agent)
          WHERE id = session_record.id;
        ELSE
          reason := 'Session flagged for suspicious activity';
          INSERT INTO public.security_events (user_id, event_type, severity, details, ip_address, user_agent)
          VALUES (p_user_id, 'suspicious_session_activity', 'medium', 
                  jsonb_build_object('risk_score', risk_score, 'flags', security_flags),
                  p_ip_address, p_user_agent);
        END IF;
      ELSE
        reason := 'Session timeout due to inactivity';
        UPDATE public.active_sessions SET is_active = false WHERE id = session_record.id;
      END IF;
    ELSE
      reason := 'Session expired';
      UPDATE public.active_sessions SET is_active = false WHERE id = session_record.id;
    END IF;
  ELSE
    reason := 'Session not found or inactive';
  END IF;
  
  INSERT INTO public.audit_logs (user_id, action, table_name, new_values)
  VALUES (p_user_id, 'session_validation', 'active_sessions',
          jsonb_build_object('valid', is_valid, 'reason', reason, 'risk_score', risk_score));
  
  RETURN jsonb_build_object(
    'valid', is_valid,
    'reason', reason,
    'requires_reauth', NOT is_valid,
    'risk_score', risk_score,
    'security_flags', security_flags
  );
END;
$$;