-- Fix email account token security vulnerability (corrected)

-- Create trigger to automatically encrypt tokens on insert/update
DROP TRIGGER IF EXISTS encrypt_email_tokens_trigger ON public.email_accounts;
CREATE TRIGGER encrypt_email_tokens_trigger
  BEFORE INSERT OR UPDATE ON public.email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_email_account_tokens();

-- Add additional security policies to email_accounts
-- Drop existing policies to recreate with enhanced security
DROP POLICY IF EXISTS "Users can create their own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can view their own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can update their own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can delete their own email accounts" ON public.email_accounts;

-- Recreate policies with additional security checks
CREATE POLICY "Users can create their own email accounts with validation"
ON public.email_accounts
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  access_token IS NOT NULL AND
  refresh_token IS NOT NULL AND
  email_address IS NOT NULL
);

CREATE POLICY "Users can view their own email accounts only"
ON public.email_accounts
FOR SELECT
USING (
  auth.uid() = user_id AND
  is_active = true
);

CREATE POLICY "Users can update their own email accounts securely"
ON public.email_accounts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND
  user_id = OLD.user_id
);

CREATE POLICY "Users can deactivate their own email accounts"
ON public.email_accounts
FOR DELETE
USING (auth.uid() = user_id);

-- Add audit logging for token access (fixed)
CREATE OR REPLACE FUNCTION public.audit_email_token_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log access to email tokens for security monitoring
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.security_events (
      user_id, event_type, severity, details
    ) VALUES (
      auth.uid(),
      'email_token_deleted',
      'medium',
      jsonb_build_object(
        'email_address', OLD.email_address,
        'operation', TG_OP,
        'timestamp', now()
      )
    );
    RETURN OLD;
  ELSE
    INSERT INTO public.security_events (
      user_id, event_type, severity, details
    ) VALUES (
      auth.uid(),
      'email_token_access',
      'medium',
      jsonb_build_object(
        'email_address', NEW.email_address,
        'operation', TG_OP,
        'timestamp', now()
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

-- Create audit trigger
DROP TRIGGER IF EXISTS audit_email_token_access_trigger ON public.email_accounts;
CREATE TRIGGER audit_email_token_access_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_email_token_access();

-- Enhance the secure token retrieval function with additional validation
CREATE OR REPLACE FUNCTION public.get_secure_email_tokens_enhanced(
  p_user_id uuid, 
  p_email_address text
)
RETURNS TABLE(
  decrypted_access_token text, 
  decrypted_refresh_token text, 
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
  -- Additional security check: only allow access by token owner
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized token access attempt';
  END IF;
  
  -- Log the token access for monitoring
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    p_user_id,
    'email_token_decryption',
    'low',
    jsonb_build_object(
      'email_address', p_email_address,
      'timestamp', current_time
    )
  );
  
  RETURN QUERY
  SELECT 
    public.decrypt_token(access_token) as decrypted_access_token,
    public.decrypt_token(refresh_token) as decrypted_refresh_token,
    email_accounts.expires_at,
    (email_accounts.expires_at < current_time) as is_expired
  FROM public.email_accounts
  WHERE user_id = p_user_id
    AND email_address = p_email_address
    AND is_active = true;
END;
$$;