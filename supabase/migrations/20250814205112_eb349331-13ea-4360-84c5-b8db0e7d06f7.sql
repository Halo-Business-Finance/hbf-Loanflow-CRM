-- Fix the encryption functions to use the correct encode/decode function signatures
CREATE OR REPLACE FUNCTION public.encrypt_token(p_token text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  encryption_key text;
BEGIN
  -- Get active encryption key
  encryption_key := public.get_active_encryption_key();
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'No valid encryption key available';
  END IF;
  
  -- Use encode with correct signature: encode(bytea, format)
  RETURN encode(
    extensions.encrypt(
      p_token::bytea, 
      encryption_key::bytea, 
      'aes'
    ), 
    'base64'
  );
END;
$function$;

-- Also fix the decrypt_token function
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
  
  IF encryption_key IS NULL THEN
    RETURN NULL;
  END IF;
  
  BEGIN
    -- Use decode with correct signature: decode(text, format)
    decrypted_bytea := extensions.decrypt(
      decode(p_encrypted_token, 'base64'), 
      encryption_key::bytea, 
      'aes'
    );
    RETURN convert_from(decrypted_bytea, 'UTF8');
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$function$;