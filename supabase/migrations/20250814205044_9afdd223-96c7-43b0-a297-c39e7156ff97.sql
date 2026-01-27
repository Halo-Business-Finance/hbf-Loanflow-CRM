-- Fix the encrypt_token function to handle null key_material properly
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
  
  -- The get_active_encryption_key function should handle null cases
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'No valid encryption key available';
  END IF;
  
  RETURN extensions.encode(
    extensions.encrypt(
      convert_to(p_token, 'UTF8'), 
      convert_to(encryption_key, 'UTF8'), 
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
    decrypted_bytea := extensions.decrypt(
      extensions.decode(p_encrypted_token, 'base64'), 
      convert_to(encryption_key, 'UTF8'), 
      'aes'
    );
    RETURN convert_from(decrypted_bytea, 'UTF8');
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$function$;

-- Update the key material to be NOT NULL since it's critical
UPDATE encryption_keys SET key_material = encode(gen_random_bytes(32), 'base64') WHERE key_material IS NULL;