-- Fix the encrypt_token function to properly cast the encoding parameter
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
  RETURN extensions.encode(extensions.encrypt(p_token::bytea, encryption_key::bytea, 'aes'), 'base64'::text);
END;
$function$;

-- Fix the decrypt_token function to properly cast the encoding parameter
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
    decrypted_bytea := extensions.decrypt(extensions.decode(p_encrypted_token, 'base64'::text), encryption_key::bytea, 'aes');
    RETURN convert_from(decrypted_bytea, 'UTF8');
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$function$;