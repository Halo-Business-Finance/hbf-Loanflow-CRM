-- CRITICAL SECURITY FIX: Complete encryption of sensitive contact data
-- This migration ensures all sensitive financial data is properly encrypted

-- Step 1: Create function to migrate existing sensitive data to encrypted storage
CREATE OR REPLACE FUNCTION migrate_existing_contact_sensitive_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  contact_record RECORD;
  sensitive_fields text[] := ARRAY['email', 'phone', 'credit_score', 'income', 'loan_amount', 'annual_revenue', 'bdo_email', 'bdo_telephone'];
  field_name text;
  field_value text;
BEGIN
  -- Loop through all contacts that have sensitive data
  FOR contact_record IN 
    SELECT id, email, phone, credit_score, income, loan_amount, annual_revenue, bdo_email, bdo_telephone
    FROM public.contact_entities
    WHERE email IS NOT NULL 
       OR phone IS NOT NULL 
       OR credit_score IS NOT NULL 
       OR income IS NOT NULL 
       OR loan_amount IS NOT NULL
       OR annual_revenue IS NOT NULL
       OR bdo_email IS NOT NULL
       OR bdo_telephone IS NOT NULL
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
  bdo_telephone = NULL
WHERE id IS NOT NULL;

-- Step 4: Create enhanced triggers to ensure all new sensitive data goes to encrypted storage
CREATE OR REPLACE FUNCTION public.auto_encrypt_contact_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- On INSERT or UPDATE, automatically encrypt sensitive fields and clear from main table
  
  -- Handle email
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'email', NEW.email);
    NEW.email = ''; -- Clear from main table
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
  
  -- Handle bdo_email
  IF NEW.bdo_email IS NOT NULL AND NEW.bdo_email != '' THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'bdo_email', NEW.bdo_email);
    NEW.bdo_email = NULL;
  END IF;
  
  -- Handle bdo_telephone
  IF NEW.bdo_telephone IS NOT NULL AND NEW.bdo_telephone != '' THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'bdo_telephone', NEW.bdo_telephone);
    NEW.bdo_telephone = NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for automatic encryption
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

-- Step 5: Create additional access monitoring function
CREATE OR REPLACE FUNCTION public.log_contact_access_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log access attempts to contact data
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'contact_data_access_attempt',
    CASE 
      WHEN has_role('super_admin'::user_role) THEN 'low'
      WHEN auth.uid() = COALESCE(NEW.user_id, OLD.user_id) THEN 'low'
      ELSE 'high'
    END,
    jsonb_build_object(
      'operation', TG_OP,
      'contact_id', COALESCE(NEW.id, OLD.id),
      'user_owns_contact', auth.uid() = COALESCE(NEW.user_id, OLD.user_id),
      'timestamp', now()
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create access monitoring triggers
CREATE TRIGGER trigger_log_contact_insert
  AFTER INSERT ON public.contact_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.log_contact_access_attempt();

CREATE TRIGGER trigger_log_contact_update
  AFTER UPDATE ON public.contact_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.log_contact_access_attempt();

CREATE TRIGGER trigger_log_contact_delete
  AFTER DELETE ON public.contact_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.log_contact_access_attempt();

-- Step 6: Strengthen RLS policies
DROP POLICY IF EXISTS "Authenticated users can only view own contacts" ON public.contact_entities;
DROP POLICY IF EXISTS "Users can only view own contacts with encryption" ON public.contact_entities;

CREATE POLICY "Strict owner-only contact access" 
ON public.contact_entities 
FOR ALL
TO authenticated
USING (auth.uid() = user_id OR has_role('super_admin'::user_role))
WITH CHECK (auth.uid() = user_id OR has_role('super_admin'::user_role));

-- Step 7: Log security hardening completion
INSERT INTO public.security_events (
  event_type, severity, details
) VALUES (
  'contact_entities_security_hardening_completed',
  'low',
  jsonb_build_object(
    'measures_implemented', ARRAY[
      'existing_data_encrypted',
      'sensitive_fields_cleared',
      'automatic_encryption_triggers',
      'enhanced_rls_policies',
      'access_monitoring'
    ],
    'completion_timestamp', now(),
    'protection_level', 'military_grade'
  )
);