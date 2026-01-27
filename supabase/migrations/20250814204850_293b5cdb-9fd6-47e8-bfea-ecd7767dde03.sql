-- First, let's create an encryption key if one doesn't exist
INSERT INTO encryption_keys (key_material, is_active, created_at, last_rotated)
VALUES (
  encode(gen_random_bytes(32), 'base64'),
  true,
  now(),
  now()
) 
ON CONFLICT DO NOTHING;

-- Also update all functions that use extensions.encode to properly cast the encoding parameter
CREATE OR REPLACE FUNCTION public.encrypt_contact_field(p_contact_id uuid, p_field_name text, p_field_value text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  field_hash text;
BEGIN
  -- Create a searchable hash (first 3 chars + masked rest for email, partial for phone)
  field_hash := CASE 
    WHEN p_field_name = 'email' THEN 
      SPLIT_PART(p_field_value, '@', 1) || '@' || 
      LEFT(SPLIT_PART(p_field_value, '@', 2), 2) || '***'
    WHEN p_field_name = 'phone' THEN 
      LEFT(p_field_value, 3) || '***' || RIGHT(p_field_value, 3)
    ELSE LEFT(p_field_value, 3) || repeat('*', GREATEST(LENGTH(p_field_value) - 3, 0))
  END;
  
  INSERT INTO public.contact_encrypted_fields (
    contact_id, field_name, encrypted_value, field_hash
  ) VALUES (
    p_contact_id, p_field_name, public.encrypt_token(p_field_value), field_hash
  )
  ON CONFLICT (contact_id, field_name)
  DO UPDATE SET
    encrypted_value = public.encrypt_token(p_field_value),
    field_hash = field_hash,
    updated_at = now();
END;
$function$;