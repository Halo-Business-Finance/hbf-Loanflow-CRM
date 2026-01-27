-- Add missing home address fields to contact_entities and update security functions
BEGIN;

-- 1) Add columns (safe if they already exist)
ALTER TABLE public.contact_entities
  ADD COLUMN IF NOT EXISTS home_address TEXT,
  ADD COLUMN IF NOT EXISTS home_city TEXT,
  ADD COLUMN IF NOT EXISTS home_state TEXT,
  ADD COLUMN IF NOT EXISTS home_zip_code TEXT;

-- 2) Update auto encryption trigger function to include home_address masking/encryption
CREATE OR REPLACE FUNCTION public.auto_encrypt_contact_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-encrypt email if present and not already encrypted
  IF NEW.email IS NOT NULL AND (OLD.email IS NULL OR NEW.email != OLD.email) THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'email', NEW.email);
    -- Mask the email in the main table for additional security
    NEW.email := SPLIT_PART(NEW.email, '@', 1) || '@***';
  END IF;
  
  -- Auto-encrypt phone if present and not already encrypted
  IF NEW.phone IS NOT NULL AND (OLD.phone IS NULL OR NEW.phone != OLD.phone) THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'phone', NEW.phone);
    -- Mask the phone in the main table
    NEW.phone := LEFT(NEW.phone, 3) || '***' || RIGHT(NEW.phone, 3);
  END IF;
  
  -- Auto-encrypt credit score if present
  IF NEW.credit_score IS NOT NULL AND (OLD.credit_score IS NULL OR NEW.credit_score != OLD.credit_score) THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'credit_score', NEW.credit_score::text);
    -- Mask the credit score
    NEW.credit_score := 999; -- Masked value
  END IF;
  
  -- Auto-encrypt income if present
  IF NEW.income IS NOT NULL AND (OLD.income IS NULL OR NEW.income != OLD.income) THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'income', NEW.income::text);
    -- Zero out the income field for security
    NEW.income := 0;
  END IF;
  
  -- Auto-encrypt loan amount if present
  IF NEW.loan_amount IS NOT NULL AND (OLD.loan_amount IS NULL OR NEW.loan_amount != OLD.loan_amount) THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'loan_amount', NEW.loan_amount::text);
    -- Zero out the loan amount for security
    NEW.loan_amount := 0;
  END IF;
  
  -- Auto-encrypt annual revenue if present
  IF NEW.annual_revenue IS NOT NULL AND (OLD.annual_revenue IS NULL OR NEW.annual_revenue != OLD.annual_revenue) THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'annual_revenue', NEW.annual_revenue::text);
    -- Zero out the annual revenue for security
    NEW.annual_revenue := 0;
  END IF;
  
  -- Auto-encrypt business address if present
  IF NEW.business_address IS NOT NULL AND (OLD.business_address IS NULL OR NEW.business_address != OLD.business_address) THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'business_address', NEW.business_address);
    -- Mask the business address
    NEW.business_address := LEFT(NEW.business_address, 10) || '*** [ENCRYPTED]';
  END IF;

  -- Auto-encrypt HOME address if present (NEW)
  IF NEW.home_address IS NOT NULL AND (OLD.home_address IS NULL OR NEW.home_address != OLD.home_address) THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'home_address', NEW.home_address);
    -- Mask the home address
    NEW.home_address := LEFT(NEW.home_address, 10) || '*** [ENCRYPTED]';
  END IF;
  
  -- Auto-encrypt BDO sensitive fields
  IF NEW.bdo_email IS NOT NULL AND (OLD.bdo_email IS NULL OR NEW.bdo_email != OLD.bdo_email) THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'bdo_email', NEW.bdo_email);
    NEW.bdo_email := LEFT(NEW.bdo_email, 2) || '***@***';
  END IF;
  
  IF NEW.bdo_telephone IS NOT NULL AND (OLD.bdo_telephone IS NULL OR NEW.bdo_telephone != OLD.bdo_telephone) THEN
    PERFORM public.encrypt_contact_field_enhanced(NEW.id, 'bdo_telephone', NEW.bdo_telephone);
    NEW.bdo_telephone := LEFT(NEW.bdo_telephone, 3) || '***';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3) Update secure data access function to include home_* fields in base payload and sensitive list
CREATE OR REPLACE FUNCTION public.get_masked_contact_data_enhanced(p_contact_id uuid, p_requesting_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  contact_data jsonb;
  requesting_user_role text;
  is_owner boolean;
  masked_data jsonb := '{}'::jsonb;
  encrypted_data jsonb;
  sensitive_fields text[] := ARRAY['email', 'phone', 'credit_score', 'income', 'loan_amount', 'annual_revenue', 'bdo_email', 'bdo_telephone', 'home_address'];
  field_name text;
BEGIN
  -- Validate input
  IF p_contact_id IS NULL OR p_requesting_user_id IS NULL THEN
    RAISE EXCEPTION 'Contact ID and requesting user ID must be provided';
  END IF;
  
  -- Check if requesting user owns this contact
  SELECT (user_id = p_requesting_user_id) INTO is_owner
  FROM public.contact_entities
  WHERE id = p_contact_id;
  
  IF is_owner IS NULL THEN
    -- Log unauthorized access attempt
    INSERT INTO public.security_events (
      user_id, event_type, severity, details
    ) VALUES (
      p_requesting_user_id,
      'unauthorized_contact_access_attempt',
      'high',
      jsonb_build_object(
        'contact_id', p_contact_id,
        'reason', 'contact_not_found'
      )
    );
    RETURN null;
  END IF;
  
  -- Get requesting user's role
  SELECT public.get_user_role(p_requesting_user_id)::text INTO requesting_user_role;
  
  -- Get basic contact data (non-sensitive fields + home_* for display)
  SELECT jsonb_build_object(
    'id', ce.id,
    'name', ce.name,
    'email', ce.email,
    'phone', ce.phone,
    'location', ce.location,
    'business_name', ce.business_name,
    'business_address', ce.business_address,
    'home_address', ce.home_address,
    'home_city', ce.home_city,
    'home_state', ce.home_state,
    'home_zip_code', ce.home_zip_code,
    'year_established', ce.year_established,
    'naics_code', ce.naics_code,
    'ownership_structure', ce.ownership_structure,
    'stage', ce.stage,
    'priority', ce.priority,
    'loan_type', ce.loan_type,
    'interest_rate', ce.interest_rate,
    'maturity_date', ce.maturity_date,
    'existing_loan_amount', ce.existing_loan_amount,
    'net_operating_income', ce.net_operating_income,
    'property_payment_amount', ce.property_payment_amount,
    'owns_property', ce.owns_property,
    'pos_system', ce.pos_system,
    'processor_name', ce.processor_name,
    'current_processing_rate', ce.current_processing_rate,
    'monthly_processing_volume', ce.monthly_processing_volume,
    'average_transaction_size', ce.average_transaction_size,
    'bank_lender_name', ce.bank_lender_name,
    'notes', ce.notes,
    'call_notes', ce.call_notes,
    'created_at', ce.created_at,
    'updated_at', ce.updated_at,
    'user_id', ce.user_id
  ) INTO contact_data
  FROM public.contact_entities ce
  WHERE ce.id = p_contact_id;
  
  masked_data := contact_data;
  
  IF is_owner OR requesting_user_role = 'super_admin' THEN
    SELECT jsonb_object_agg(
      cef.field_name, 
      public.decrypt_token(cef.encrypted_value)
    ) INTO encrypted_data
    FROM public.contact_encrypted_fields cef
    WHERE cef.contact_id = p_contact_id;
    
    masked_data := masked_data || COALESCE(encrypted_data, '{}'::jsonb);
  ELSIF requesting_user_role IN ('admin', 'manager') THEN
    SELECT jsonb_object_agg(
      cef.field_name,
      cef.field_hash
    ) INTO encrypted_data
    FROM public.contact_encrypted_fields cef
    WHERE cef.contact_id = p_contact_id;
    
    masked_data := masked_data || COALESCE(encrypted_data, '{}'::jsonb);
    
    FOREACH field_name IN ARRAY sensitive_fields
    LOOP
      EXECUTE format('SELECT %I FROM public.contact_entities WHERE id = $1', field_name) 
      USING p_contact_id INTO encrypted_data;
      
      IF encrypted_data IS NOT NULL THEN
        masked_data := jsonb_set(masked_data, ARRAY[field_name], to_jsonb('***masked***'));
      END IF;
    END LOOP;
  ELSE
    masked_data := jsonb_build_object(
      'id', contact_data->>'id',
      'business_name', contact_data->>'business_name',
      'stage', contact_data->>'stage',
      'priority', contact_data->>'priority'
    );
  END IF;
  
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    p_requesting_user_id,
    'secure_contact_data_access',
    CASE 
      WHEN is_owner THEN 'low'
      WHEN requesting_user_role IN ('admin', 'manager') THEN 'medium'
      ELSE 'high'
    END,
    jsonb_build_object(
      'accessed_contact_id', p_contact_id,
      'requesting_user_role', requesting_user_role,
      'is_owner', is_owner,
      'data_access_level', CASE 
        WHEN is_owner OR requesting_user_role = 'super_admin' THEN 'full'
        WHEN requesting_user_role IN ('admin', 'manager') THEN 'masked'
        ELSE 'minimal'
      END
    )
  );
  
  RETURN masked_data;
END;
$$;

COMMIT;