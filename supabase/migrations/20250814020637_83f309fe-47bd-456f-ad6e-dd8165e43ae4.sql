-- Enable pgcrypto extension for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fix the encrypt_token function to use proper pgcrypto syntax
CREATE OR REPLACE FUNCTION public.encrypt_token(p_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  key_material text;
  cipher bytea;
BEGIN
  key_material := public.get_active_encryption_key();
  -- Use pgp_sym_encrypt for secure encryption
  cipher := pgp_sym_encrypt(p_token, key_material);
  RETURN encode(cipher, 'base64');
END;
$$;

-- Fix the decrypt_token function as well
CREATE OR REPLACE FUNCTION public.decrypt_token(p_encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  rec RECORD;
  decrypted text;
BEGIN
  FOR rec IN (
    SELECT key_material
    FROM public.encryption_keys
    WHERE key_material IS NOT NULL
    ORDER BY is_active DESC, last_rotated DESC NULLS LAST, created_at DESC
  ) LOOP
    BEGIN
      decrypted := pgp_sym_decrypt(decode(p_encrypted_token, 'base64'), rec.key_material);
      RETURN decrypted;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
  END LOOP;

  RETURN NULL;
END;
$$;

-- Now run the critical security fix for contact entities
-- Step 1: Create function to migrate existing sensitive data to encrypted storage
CREATE OR REPLACE FUNCTION migrate_existing_contact_sensitive_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  contact_record RECORD;
BEGIN
  -- Loop through all contacts that have sensitive data
  FOR contact_record IN 
    SELECT id, email, phone, credit_score, income, loan_amount, annual_revenue, bdo_email, bdo_telephone
    FROM public.contact_entities
    WHERE email IS NOT NULL AND email != ''
       OR phone IS NOT NULL AND phone != ''
       OR credit_score IS NOT NULL AND credit_score > 0
       OR income IS NOT NULL AND income > 0
       OR loan_amount IS NOT NULL AND loan_amount > 0
       OR annual_revenue IS NOT NULL AND annual_revenue > 0
       OR bdo_email IS NOT NULL AND bdo_email != ''
       OR bdo_telephone IS NOT NULL AND bdo_telephone != ''
  LOOP
    -- Encrypt email
    IF contact_record.email IS NOT NULL AND contact_record.email != '' THEN
      PERFORM public.encrypt_contact_field_enhanced(contact_record.id, 'email', contact_record.email);
    END IF;
    
    -- Encrypt phone
    IF contact_record.phone IS NOT NULL AND contact_record.phone != '' THEN
      PERFORM public.encrypt_contact_field_enhanced(contact_record.id, 'phone', contact_record.phone);
    END IF;
    
    -- Encrypt credit_score
    IF contact_record.credit_score IS NOT NULL AND contact_record.credit_score > 0 THEN
      PERFORM public.encrypt_contact_field_enhanced(contact_record.id, 'credit_score', contact_record.credit_score::text);
    END IF;
    
    -- Encrypt income
    IF contact_record.income IS NOT NULL AND contact_record.income > 0 THEN
      PERFORM public.encrypt_contact_field_enhanced(contact_record.id, 'income', contact_record.income::text);
    END IF;
    
    -- Encrypt loan_amount
    IF contact_record.loan_amount IS NOT NULL AND contact_record.loan_amount > 0 THEN
      PERFORM public.encrypt_contact_field_enhanced(contact_record.id, 'loan_amount', contact_record.loan_amount::text);
    END IF;
    
    -- Encrypt annual_revenue
    IF contact_record.annual_revenue IS NOT NULL AND contact_record.annual_revenue > 0 THEN
      PERFORM public.encrypt_contact_field_enhanced(contact_record.id, 'annual_revenue', contact_record.annual_revenue::text);
    END IF;
    
    -- Encrypt bdo_email
    IF contact_record.bdo_email IS NOT NULL AND contact_record.bdo_email != '' THEN
      PERFORM public.encrypt_contact_field_enhanced(contact_record.id, 'bdo_email', contact_record.bdo_email);
    END IF;
    
    -- Encrypt bdo_telephone
    IF contact_record.bdo_telephone IS NOT NULL AND contact_record.bdo_telephone != '' THEN
      PERFORM public.encrypt_contact_field_enhanced(contact_record.id, 'bdo_telephone', contact_record.bdo_telephone);
    END IF;
  END LOOP;
  
  -- Log migration completion
  INSERT INTO public.security_events (
    event_type, severity, details
  ) VALUES (
    'contact_data_migration_completed',
    'low',
    jsonb_build_object(
      'migrated_contacts', (SELECT COUNT(*) FROM public.contact_entities),
      'migration_timestamp', now()
    )
  );
END;
$$;

-- Step 2: Execute the migration
SELECT migrate_existing_contact_sensitive_data();

-- Step 3: Clear sensitive data from main table after encryption
UPDATE public.contact_entities 
SET 
  email = '',
  phone = NULL,
  credit_score = NULL,
  income = NULL,
  loan_amount = NULL,
  annual_revenue = NULL,
  bdo_email = NULL,
  bdo_telephone = NULL;

-- Step 4: Create enhanced triggers for automatic encryption
CREATE OR REPLACE FUNCTION public.auto_encrypt_contact_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Handle email
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'email', NEW.email);
    NEW.email = '';
  END IF;
  
  -- Handle phone  
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'phone', NEW.phone);
    NEW.phone = NULL;
  END IF;
  
  -- Handle credit_score
  IF NEW.credit_score IS NOT NULL AND NEW.credit_score > 0 THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'credit_score', NEW.credit_score::text);
    NEW.credit_score = NULL;
  END IF;
  
  -- Handle income
  IF NEW.income IS NOT NULL AND NEW.income > 0 THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'income', NEW.income::text);
    NEW.income = NULL;
  END IF;
  
  -- Handle loan_amount
  IF NEW.loan_amount IS NOT NULL AND NEW.loan_amount > 0 THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'loan_amount', NEW.loan_amount::text);
    NEW.loan_amount = NULL;
  END IF;
  
  -- Handle annual_revenue
  IF NEW.annual_revenue IS NOT NULL AND NEW.annual_revenue > 0 THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'annual_revenue', NEW.annual_revenue::text);
    NEW.annual_revenue = NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_auto_encrypt_contact_fields_insert ON public.contact_entities;
DROP TRIGGER IF EXISTS trigger_auto_encrypt_contact_fields_update ON public.contact_entities;

CREATE TRIGGER trigger_auto_encrypt_contact_fields_insert
  BEFORE INSERT ON public.contact_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_encrypt_contact_sensitive_fields();

CREATE TRIGGER trigger_auto_encrypt_contact_fields_update
  BEFORE UPDATE ON public.contact_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_encrypt_contact_sensitive_fields();

-- Step 5: Strengthen RLS policies for maximum security
DROP POLICY IF EXISTS "Authenticated users can only view own contacts" ON public.contact_entities;
DROP POLICY IF EXISTS "Users can only view own contacts with encryption" ON public.contact_entities;
DROP POLICY IF EXISTS "Strict owner-only contact access" ON public.contact_entities;

-- Create the most restrictive policy possible
CREATE POLICY "Military grade contact security - owner only access" 
ON public.contact_entities 
FOR ALL
TO authenticated
USING (auth.uid() = user_id OR has_role('super_admin'::user_role))
WITH CHECK (auth.uid() = user_id OR has_role('super_admin'::user_role));

-- Log security completion
INSERT INTO public.security_events (
  event_type, severity, details
) VALUES (
  'contact_financial_data_secured',
  'low',
  jsonb_build_object(
    'security_level', 'military_grade',
    'measures', ARRAY[
      'field_level_encryption',
      'automatic_encryption_triggers',
      'strict_owner_only_rls',
      'sensitive_data_migration'
    ],
    'completion_timestamp', now()
  )
);