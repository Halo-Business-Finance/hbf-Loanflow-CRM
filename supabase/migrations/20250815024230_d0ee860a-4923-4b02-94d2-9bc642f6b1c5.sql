-- Fix the search path security warning
CREATE OR REPLACE FUNCTION public.auto_encrypt_contact_fields()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- For now, just mask sensitive fields without encryption to test basic functionality
  
  -- Mask email if present
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    NEW.email := SPLIT_PART(NEW.email, '@', 1) || '@***';
  END IF;
  
  -- Mask phone if present  
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    NEW.phone := LEFT(NEW.phone, 3) || '***' || RIGHT(NEW.phone, 3);
  END IF;
  
  -- Keep other fields as-is for now (no encryption)
  
  RETURN NEW;
END;
$$;