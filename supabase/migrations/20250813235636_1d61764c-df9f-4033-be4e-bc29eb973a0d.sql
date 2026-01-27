-- Fix email account token security vulnerability (simplified approach)

-- Create trigger to automatically encrypt tokens on insert/update
-- The function already exists, just ensure trigger is active
DROP TRIGGER IF EXISTS encrypt_email_tokens_trigger ON public.email_accounts;
CREATE TRIGGER encrypt_email_tokens_trigger
  BEFORE INSERT OR UPDATE ON public.email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_email_account_tokens();

-- Enhanced RLS policies for email_accounts
DROP POLICY IF EXISTS "Users can create their own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can view their own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can update their own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can delete their own email accounts" ON public.email_accounts;

-- Create more secure policies
CREATE POLICY "Secure email account creation"
ON public.email_accounts
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  access_token IS NOT NULL AND
  refresh_token IS NOT NULL AND
  email_address IS NOT NULL
);

CREATE POLICY "Secure email account viewing"
ON public.email_accounts
FOR SELECT
USING (
  auth.uid() = user_id AND
  is_active = true
);

CREATE POLICY "Secure email account updates"
ON public.email_accounts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Secure email account deletion"
ON public.email_accounts
FOR DELETE
USING (auth.uid() = user_id);

-- Add security monitoring function for token access
CREATE OR REPLACE FUNCTION public.log_email_token_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log token access events for security monitoring
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    CASE TG_OP 
      WHEN 'INSERT' THEN 'email_token_created'
      WHEN 'UPDATE' THEN 'email_token_updated'
      WHEN 'DELETE' THEN 'email_token_deleted'
    END,
    'medium',
    jsonb_build_object(
      'email_address', COALESCE(NEW.email_address, OLD.email_address),
      'operation', TG_OP,
      'timestamp', now()
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create audit trigger for security monitoring
DROP TRIGGER IF EXISTS log_email_token_access_trigger ON public.email_accounts;
CREATE TRIGGER log_email_token_access_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_email_token_access();

-- Create enhanced secure token retrieval function
CREATE OR REPLACE FUNCTION public.get_email_tokens_secure(
  p_email_address text
)
RETURNS TABLE(
  access_token text, 
  refresh_token text, 
  expires_at timestamp with time zone,
  is_expired boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  current_time timestamp with time zone := now();
BEGIN
  -- Log the token access attempt
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'email_token_decrypt_request',
    'low',
    jsonb_build_object(
      'email_address', p_email_address,
      'timestamp', current_time
    )
  );
  
  -- Return decrypted tokens only for the authenticated user
  RETURN QUERY
  SELECT 
    public.decrypt_token(ea.access_token) as access_token,
    public.decrypt_token(ea.refresh_token) as refresh_token,
    ea.expires_at,
    (ea.expires_at < current_time) as is_expired
  FROM public.email_accounts ea
  WHERE ea.user_id = auth.uid()
    AND ea.email_address = p_email_address
    AND ea.is_active = true;
END;
$$;