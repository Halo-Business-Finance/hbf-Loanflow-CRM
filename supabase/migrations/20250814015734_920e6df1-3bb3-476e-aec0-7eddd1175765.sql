-- Security Enhancement: Comprehensive Contact Data Protection
-- This migration implements field-level encryption and enhanced security for contact_entities

-- 1. Enhanced encryption function with better error handling
CREATE OR REPLACE FUNCTION public.encrypt_contact_field_enhanced(
  p_contact_id uuid, 
  p_field_name text, 
  p_field_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
    encrypted_value = encrypted_value,
    field_hash = field_hash,
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
$$;

-- 2. Enhanced secure data retrieval function
CREATE OR REPLACE FUNCTION public.get_masked_contact_data_enhanced(
  p_contact_id uuid, 
  p_requesting_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  contact_data jsonb;
  requesting_user_role text;
  is_owner boolean;
  masked_data jsonb := '{}'::jsonb;
  encrypted_data jsonb;
  sensitive_fields text[] := ARRAY['email', 'phone', 'credit_score', 'income', 'loan_amount', 'annual_revenue', 'bdo_email', 'bdo_telephone'];
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
  
  -- Get basic contact data (non-sensitive fields)
  SELECT jsonb_build_object(
    'id', ce.id,
    'name', ce.name,
    'business_name', ce.business_name,
    'business_address', ce.business_address,
    'year_established', ce.year_established,
    'naics_code', ce.naics_code,
    'ownership_structure', ce.ownership_structure,
    'location', ce.location,
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
  
  -- Handle sensitive fields based on user role and ownership
  IF is_owner OR requesting_user_role = 'super_admin' THEN
    -- Full access for owner or super admin - decrypt sensitive fields
    SELECT jsonb_object_agg(
      cef.field_name, 
      public.decrypt_token(cef.encrypted_value)
    ) INTO encrypted_data
    FROM public.contact_encrypted_fields cef
    WHERE cef.contact_id = p_contact_id;
    
    -- Add decrypted fields to response
    masked_data := masked_data || COALESCE(encrypted_data, '{}'::jsonb);
    
    -- Also add any plain text sensitive fields (for backward compatibility)
    FOREACH field_name IN ARRAY sensitive_fields
    LOOP
      EXECUTE format('SELECT %I FROM public.contact_entities WHERE id = $1', field_name) 
      USING p_contact_id INTO encrypted_data;
      
      IF encrypted_data IS NOT NULL THEN
        masked_data := jsonb_set(masked_data, ARRAY[field_name], to_jsonb(encrypted_data));
      END IF;
    END LOOP;
    
  ELSIF requesting_user_role IN ('admin', 'manager') THEN
    -- Limited access with masking for admins/managers
    SELECT jsonb_object_agg(
      cef.field_name,
      cef.field_hash
    ) INTO encrypted_data
    FROM public.contact_encrypted_fields cef
    WHERE cef.contact_id = p_contact_id;
    
    masked_data := masked_data || COALESCE(encrypted_data, '{}'::jsonb);
    
    -- Add masked plain text fields
    FOREACH field_name IN ARRAY sensitive_fields
    LOOP
      EXECUTE format('SELECT %I FROM public.contact_entities WHERE id = $1', field_name) 
      USING p_contact_id INTO encrypted_data;
      
      IF encrypted_data IS NOT NULL THEN
        -- Apply masking based on field type
        masked_data := jsonb_set(masked_data, ARRAY[field_name], 
          to_jsonb(CASE 
            WHEN field_name = 'email' THEN 
              SPLIT_PART(encrypted_data::text, '@', 1) || '@***'
            WHEN field_name = 'phone' THEN 
              LEFT(encrypted_data::text, 3) || '***' || RIGHT(encrypted_data::text, 3)
            WHEN field_name IN ('credit_score', 'income', 'loan_amount', 'annual_revenue') THEN 
              '***'
            ELSE '***masked***'
          END)
        );
      END IF;
    END LOOP;
    
  ELSE
    -- Very limited access for other roles - only business info
    masked_data := jsonb_build_object(
      'id', contact_data->>'id',
      'business_name', contact_data->>'business_name',
      'stage', contact_data->>'stage',
      'priority', contact_data->>'priority'
    );
  END IF;
  
  -- Log data access for security monitoring
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
      END,
      'fields_accessed', array_length(array(SELECT jsonb_object_keys(masked_data)), 1)
    )
  );
  
  RETURN masked_data;
END;
$$;

-- 3. Batch encryption function for existing data
CREATE OR REPLACE FUNCTION public.encrypt_existing_contact_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  contact_record RECORD;
  encryption_count integer := 0;
  error_count integer := 0;
  sensitive_fields text[] := ARRAY['email', 'phone', 'credit_score', 'income', 'loan_amount', 'annual_revenue', 'bdo_email', 'bdo_telephone'];
  field_name text;
  field_value text;
BEGIN
  -- Only allow admins to run this function
  IF NOT public.has_role('admin'::user_role) THEN
    RAISE EXCEPTION 'Only administrators can encrypt existing contact data';
  END IF;
  
  -- Process each contact
  FOR contact_record IN 
    SELECT * FROM public.contact_entities 
    WHERE id NOT IN (
      SELECT DISTINCT contact_id FROM public.contact_encrypted_fields
    )
  LOOP
    BEGIN
      -- Encrypt each sensitive field if it has a value
      FOREACH field_name IN ARRAY sensitive_fields
      LOOP
        EXECUTE format('SELECT %I FROM public.contact_entities WHERE id = $1', field_name) 
        USING contact_record.id INTO field_value;
        
        IF field_value IS NOT NULL AND field_value != '' THEN
          PERFORM public.encrypt_contact_field_enhanced(
            contact_record.id, 
            field_name, 
            field_value
          );
          encryption_count := encryption_count + 1;
        END IF;
      END LOOP;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      -- Log the error but continue processing
      INSERT INTO public.security_events (
        user_id, event_type, severity, details
      ) VALUES (
        auth.uid(),
        'contact_encryption_error',
        'medium',
        jsonb_build_object(
          'contact_id', contact_record.id,
          'error_message', SQLERRM
        )
      );
    END;
  END LOOP;
  
  -- Log the batch encryption completion
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    'batch_contact_encryption_completed',
    'low',
    jsonb_build_object(
      'fields_encrypted', encryption_count,
      'errors_encountered', error_count
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'fields_encrypted', encryption_count,
    'errors_encountered', error_count
  );
END;
$$;

-- 4. Trigger to automatically encrypt sensitive fields on insert/update
CREATE OR REPLACE FUNCTION public.encrypt_contact_sensitive_fields()
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
  -- Encrypt sensitive fields on insert or update
  FOREACH field_name IN ARRAY sensitive_fields
  LOOP
    EXECUTE format('SELECT ($1).%I', field_name) USING NEW INTO field_value;
    
    IF field_value IS NOT NULL AND field_value != '' THEN
      -- Only encrypt if not already encrypted
      IF NOT EXISTS (
        SELECT 1 FROM public.contact_encrypted_fields 
        WHERE contact_id = NEW.id AND field_name = field_name
      ) OR TG_OP = 'UPDATE' THEN
        PERFORM public.encrypt_contact_field_enhanced(NEW.id, field_name, field_value);
      END IF;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS encrypt_contact_fields_trigger ON public.contact_entities;
CREATE TRIGGER encrypt_contact_fields_trigger
  AFTER INSERT OR UPDATE ON public.contact_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_contact_sensitive_fields();

-- 5. Enhanced RLS policies for contact_encrypted_fields
DROP POLICY IF EXISTS "Super admins can view all encrypted fields" ON public.contact_encrypted_fields;
DROP POLICY IF EXISTS "Users can view encrypted fields for their contacts" ON public.contact_encrypted_fields;
DROP POLICY IF EXISTS "System can manage encrypted fields" ON public.contact_encrypted_fields;

CREATE POLICY "Owner can view encrypted fields for their contacts"
ON public.contact_encrypted_fields FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.contact_entities ce
  WHERE ce.id = contact_encrypted_fields.contact_id 
  AND ce.user_id = auth.uid()
));

CREATE POLICY "Super admin can view all encrypted fields"
ON public.contact_encrypted_fields FOR SELECT
USING (public.has_role('super_admin'::user_role));

CREATE POLICY "Admin can view encrypted field hashes only"
ON public.contact_encrypted_fields FOR SELECT
USING (public.has_role('admin'::user_role) AND NOT public.has_role('super_admin'::user_role));

CREATE POLICY "System can insert encrypted fields"
ON public.contact_encrypted_fields FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.contact_entities ce
  WHERE ce.id = contact_encrypted_fields.contact_id 
  AND ce.user_id = auth.uid()
));

CREATE POLICY "System can update encrypted fields"
ON public.contact_encrypted_fields FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.contact_entities ce
  WHERE ce.id = contact_encrypted_fields.contact_id 
  AND ce.user_id = auth.uid()
));

-- 6. Enhanced monitoring trigger for contact_entities
CREATE OR REPLACE FUNCTION public.monitor_contact_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log all access to sensitive contact data
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    CASE TG_OP 
      WHEN 'INSERT' THEN 'contact_created'
      WHEN 'UPDATE' THEN 'contact_updated'
      WHEN 'DELETE' THEN 'contact_deleted'
      ELSE 'contact_accessed'
    END,
    CASE 
      WHEN TG_OP = 'DELETE' THEN 'medium'
      ELSE 'low'
    END,
    jsonb_build_object(
      'contact_id', COALESCE(NEW.id, OLD.id),
      'operation', TG_OP,
      'timestamp', now(),
      'table_name', TG_TABLE_NAME
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create monitoring trigger
DROP TRIGGER IF EXISTS monitor_contact_access_trigger ON public.contact_entities;
CREATE TRIGGER monitor_contact_access_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.contact_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.monitor_contact_access();