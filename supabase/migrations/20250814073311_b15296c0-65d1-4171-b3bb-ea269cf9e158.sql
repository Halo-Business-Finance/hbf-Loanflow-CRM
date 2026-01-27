-- Fix the function parameter naming issue and reorganize extensions properly

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop existing encryption functions first
DROP FUNCTION IF EXISTS public.encrypt_token(text);
DROP FUNCTION IF EXISTS public.decrypt_token(text);

-- Drop and recreate pgcrypto in proper schema
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Recreate encryption functions with proper schema references
CREATE OR REPLACE FUNCTION public.encrypt_token(p_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := public.get_active_encryption_key();
  RETURN extensions.encode(extensions.encrypt(p_token::bytea, encryption_key::bytea, 'aes'), 'base64');
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_token(p_encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  encryption_key text;
  decrypted_bytea bytea;
BEGIN
  IF p_encrypted_token IS NULL OR p_encrypted_token = '' THEN
    RETURN NULL;
  END IF;
  
  encryption_key := public.get_active_encryption_key();
  
  BEGIN
    decrypted_bytea := extensions.decrypt(extensions.decode(p_encrypted_token, 'base64'), encryption_key::bytea, 'aes');
    RETURN convert_from(decrypted_bytea, 'UTF8');
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$function$;