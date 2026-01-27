-- Fix security warnings by adding SET search_path to functions
CREATE OR REPLACE FUNCTION public.initiate_gdpr_data_deletion(p_user_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  -- Mark user for deletion (in real implementation, this would trigger a deletion workflow)
  INSERT INTO public.audit_logs (user_id, action, table_name, new_values)
  VALUES (p_user_id, 'gdpr_deletion_requested', 'user_data', 
          jsonb_build_object('request_date', now(), 'status', 'pending'));
  
  RETURN true;
END;
$$;

-- Fix security warnings by adding SET search_path to functions
CREATE OR REPLACE FUNCTION public.anonymize_user_data(p_user_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  -- Anonymize sensitive data (in real implementation, this would anonymize actual data)
  INSERT INTO public.audit_logs (user_id, action, table_name, new_values)
  VALUES (p_user_id, 'data_anonymized', 'user_data',
          jsonb_build_object('anonymized_date', now()));
  
  RETURN true;
END;
$$;

-- Fix security warnings by adding SET search_path to functions
CREATE OR REPLACE FUNCTION public.create_secure_session(
  p_session_token TEXT,
  p_device_fingerprint TEXT,
  p_user_agent TEXT
)
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.active_sessions (
    user_id, session_token, device_fingerprint, user_agent, expires_at
  ) VALUES (
    auth.uid(), p_session_token, p_device_fingerprint, p_user_agent,
    now() + interval '8 hours'
  );
END;
$$;