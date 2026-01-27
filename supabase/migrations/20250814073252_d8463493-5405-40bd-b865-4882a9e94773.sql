-- Proper fix for pgcrypto extension organization
-- Remove pgcrypto from public schema and install in extensions schema

-- First check if extensions schema exists, create if not
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop the extension and recreate in proper schema
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Update function paths to use the correct schema
CREATE OR REPLACE FUNCTION public.encrypt_token(token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := public.get_active_encryption_key();
  RETURN extensions.encode(extensions.encrypt(token::bytea, encryption_key::bytea, 'aes'), 'base64');
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  encryption_key text;
  decrypted_bytea bytea;
BEGIN
  IF encrypted_token IS NULL OR encrypted_token = '' THEN
    RETURN NULL;
  END IF;
  
  encryption_key := public.get_active_encryption_key();
  
  BEGIN
    decrypted_bytea := extensions.decrypt(extensions.decode(encrypted_token, 'base64'), encryption_key::bytea, 'aes');
    RETURN convert_from(decrypted_bytea, 'UTF8');
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$function$;