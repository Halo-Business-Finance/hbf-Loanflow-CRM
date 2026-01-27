-- Fix the ambiguous column reference in encrypt_contact_field_enhanced
CREATE OR REPLACE FUNCTION public.encrypt_contact_field_enhanced(p_contact_id uuid, p_field_name text, p_field_value text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  field_hash text;
  encrypted_value text;
BEGIN
  -- Validate inputs
  IF p_contact_id IS NULL OR p_field_name IS NULL OR p_field_value IS NULL THEN
    RAISE EXCEPTION 'All parameters must be non-null';
  END IF;
  
  -- Create encrypted value
  encrypted_value := public.encrypt_token(p_field_value);
  
  -- Create a searchable hash based on field type
  field_hash := CASE 
    WHEN p_field_name = 'email' THEN 
      CASE 
        WHEN p_field_value ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
          SPLIT_PART(p_field_value, '@', 1) || '@' || 
          LEFT(SPLIT_PART(p_field_value, '@', 2), 2) || '***'
        ELSE '***masked***'
      END
    WHEN p_field_name = 'phone' THEN 
      CASE 
        WHEN LENGTH(REGEXP_REPLACE(p_field_value, '[^0-9]', '', 'g')) >= 10 THEN
          LEFT(REGEXP_REPLACE(p_field_value, '[^0-9]', '', 'g'), 3) || '***' || 
          RIGHT(REGEXP_REPLACE(p_field_value, '[^0-9]', '', 'g'), 3)
        ELSE '***masked***'
      END
    WHEN p_field_name IN ('credit_score', 'income', 'loan_amount', 'annual_revenue') THEN 
      '***'
    WHEN p_field_name IN ('bdo_email') THEN
      CASE 
        WHEN p_field_value ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
          LEFT(p_field_value, 2) || '***@' || 
          RIGHT(SPLIT_PART(p_field_value, '@', 2), 4)
        ELSE '***masked***'
      END
    WHEN p_field_name = 'bdo_telephone' THEN
      CASE 
        WHEN LENGTH(REGEXP_REPLACE(p_field_value, '[^0-9]', '', 'g')) >= 10 THEN
          LEFT(REGEXP_REPLACE(p_field_value, '[^0-9]', '', 'g'), 3) || '***' || 
          RIGHT(REGEXP_REPLACE(p_field_value, '[^0-9]', '', 'g'), 3)
        ELSE '***masked***'
      END
    ELSE 
      CASE 
        WHEN LENGTH(p_field_value) > 3 THEN
          LEFT(p_field_value, 2) || repeat('*', GREATEST(LENGTH(p_field_value) - 4, 1)) || 
          RIGHT(p_field_value, 2)
        ELSE '***'
      END
  END;
  
  -- Insert or update encrypted field
  INSERT INTO public.contact_encrypted_fields (
    contact_id, field_name, encrypted_value, field_hash
  ) VALUES (
    p_contact_id, p_field_name, encrypted_value, field_hash
  )
  ON CONFLICT (contact_id, field_name)
  DO UPDATE SET
    encrypted_value = EXCLUDED.encrypted_value,
    field_hash = EXCLUDED.field_hash,
    updated_at = now();
    
  -- Log the encryption event
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'contact_field_encrypted',
    'low',
    jsonb_build_object(
      'contact_id', p_contact_id,
      'field_name', p_field_name,
      'field_hash', field_hash
    )
  );
END;
$function$;