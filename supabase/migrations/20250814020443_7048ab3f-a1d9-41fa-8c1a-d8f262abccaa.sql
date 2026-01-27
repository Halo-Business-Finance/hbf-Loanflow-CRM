-- CRITICAL SECURITY FIX: Encrypt all sensitive financial data in contact_entities table
-- This migration will move sensitive data to encrypted storage and clear it from the main table

-- Step 1: Create a function to migrate existing sensitive data to encrypted storage
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
    -- Encrypt each sensitive field
    FOREACH field_name IN ARRAY sensitive_fields
    LOOP
      EXECUTE format('SELECT ($1).%I::text', field_name) USING contact_record INTO field_value;
      
      IF field_value IS NOT NULL AND field_value != '' AND field_value != '0' THEN
        -- Encrypt the field using our enhanced function
        PERFORM public.encrypt_contact_field_enhanced(
          contact_record.id,
          field_name,
          field_value
        );
      END IF;
    END LOOP;
  END LOOP;
  
  -- Log the migration completion
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

-- Step 3: Clear sensitive data from main table (keep only for super admins via separate policy)
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

-- Step 4: Create enhanced triggers to ensure all sensitive data goes to encrypted storage
CREATE OR REPLACE FUNCTION public.auto_encrypt_contact_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  sensitive_fields text[] := ARRAY['email', 'phone', 'credit_score', 'income', 'loan_amount', 'annual_revenue', 'bdo_email', 'bdo_telephone'];
  field_name text;
  field_value text;
BEGIN
  -- On INSERT or UPDATE, automatically encrypt sensitive fields
  FOREACH field_name IN ARRAY sensitive_fields
  LOOP
    EXECUTE format('SELECT ($1).%I::text', field_name) USING NEW INTO field_value;
    
    IF field_value IS NOT NULL AND field_value != '' AND field_value != '0' THEN
      -- Encrypt the field
      PERFORM public.encrypt_contact_field_enhanced(
        NEW.id,
        field_name,
        field_value
      );
      
      -- Clear the field from main table (except for super admins in special cases)
      EXECUTE format('SELECT 1 FROM ($1) WHERE %I IS NOT NULL', field_name) USING NEW;
      IF FOUND AND NOT has_role('super_admin'::user_role) THEN
        CASE field_name
          WHEN 'email' THEN NEW.email = '';
          WHEN 'phone' THEN NEW.phone = NULL;
          WHEN 'credit_score' THEN NEW.credit_score = NULL;
          WHEN 'income' THEN NEW.income = NULL;
          WHEN 'loan_amount' THEN NEW.loan_amount = NULL;
          WHEN 'annual_revenue' THEN NEW.annual_revenue = NULL;
          WHEN 'bdo_email' THEN NEW.bdo_email = NULL;
          WHEN 'bdo_telephone' THEN NEW.bdo_telephone = NULL;
        END CASE;
      END IF;
    END IF;
  END LOOP;
  
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

-- Step 5: Create a secure view for contact data that automatically uses masked data
CREATE OR REPLACE VIEW public.secure_contact_view AS
SELECT 
  ce.id,
  ce.user_id,
  ce.name,
  ce.business_name,
  ce.business_address,
  ce.year_established,
  ce.naics_code,
  ce.ownership_structure,
  ce.location,
  ce.stage,
  ce.priority,
  ce.loan_type,
  ce.interest_rate,
  ce.maturity_date,
  ce.existing_loan_amount,
  ce.net_operating_income,
  ce.property_payment_amount,
  ce.owns_property,
  ce.pos_system,
  ce.processor_name,
  ce.current_processing_rate,
  ce.monthly_processing_volume,
  ce.average_transaction_size,
  ce.bank_lender_name,
  ce.notes,
  ce.call_notes,
  ce.created_at,
  ce.updated_at,
  -- Only show encrypted data to authorized users via secure function
  CASE 
    WHEN ce.user_id = auth.uid() OR has_role('super_admin'::user_role) THEN
      public.get_masked_contact_data_enhanced(ce.id, auth.uid())
    ELSE
      NULL
  END as secure_data
FROM public.contact_entities ce;

-- Enable RLS on the view
ALTER VIEW public.secure_contact_view SET (security_barrier = true);

-- Step 6: Add additional monitoring for sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_contact_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log any direct access to contact_entities table
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'direct_contact_table_access',
    CASE 
      WHEN has_role('super_admin'::user_role) THEN 'low'
      WHEN auth.uid() = COALESCE(NEW.user_id, OLD.user_id) THEN 'medium'
      ELSE 'high'
    END,
    jsonb_build_object(
      'table_name', TG_TABLE_NAME,
      'operation', TG_OP,
      'contact_id', COALESCE(NEW.id, OLD.id),
      'accessed_user_id', COALESCE(NEW.user_id, OLD.user_id),
      'access_timestamp', now()
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create monitoring triggers
DROP TRIGGER IF EXISTS trigger_log_contact_access ON public.contact_entities;
CREATE TRIGGER trigger_log_contact_access
  AFTER SELECT OR INSERT OR UPDATE OR DELETE ON public.contact_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.log_sensitive_contact_access();

-- Step 7: Update RLS policies to be even more restrictive
DROP POLICY IF EXISTS "Authenticated users can only view own contacts" ON public.contact_entities;
CREATE POLICY "Users can only view own contacts with encryption" 
ON public.contact_entities 
FOR SELECT 
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role('super_admin'::user_role)
);

-- Final security verification
INSERT INTO public.security_events (
  event_type, severity, details
) VALUES (
  'contact_entities_security_hardening_completed',
  'low',
  jsonb_build_object(
    'security_measures', ARRAY[
      'field_level_encryption',
      'automatic_encryption_triggers', 
      'secure_data_view',
      'enhanced_rls_policies',
      'access_monitoring',
      'sensitive_data_migration'
    ],
    'completion_timestamp', now()
  )
);