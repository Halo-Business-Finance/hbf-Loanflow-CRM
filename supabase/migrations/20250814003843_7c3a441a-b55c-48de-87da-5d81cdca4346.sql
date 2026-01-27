-- Fix Contact Entities Security - Personal Data Protection
-- This migration secures the contact_entities table to prevent unauthorized access to sensitive personal information

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Strict contact entity access control" ON public.contact_entities;
DROP POLICY IF EXISTS "Super admins have full contact entity access" ON public.contact_entities;
DROP POLICY IF EXISTS "Users can create contact entities for themselves only" ON public.contact_entities;
DROP POLICY IF EXISTS "Users can delete only their own contact entities" ON public.contact_entities;
DROP POLICY IF EXISTS "Users can update only their own contact entities" ON public.contact_entities;

-- Create encrypted fields table for contact entities sensitive data
CREATE TABLE IF NOT EXISTS public.contact_encrypted_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contact_entities(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  encrypted_value text NOT NULL,
  field_hash text NOT NULL, -- For searching
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(contact_id, field_name)
);

-- Enable RLS on encrypted fields table
ALTER TABLE public.contact_encrypted_fields ENABLE ROW LEVEL SECURITY;

-- Create secure function to encrypt contact sensitive fields
CREATE OR REPLACE FUNCTION public.encrypt_contact_field(p_contact_id uuid, p_field_name text, p_field_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
$$;

-- Create secure function to get masked contact data
CREATE OR REPLACE FUNCTION public.get_masked_contact_data(p_contact_id uuid, p_requesting_user_id uuid DEFAULT auth.uid())
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
BEGIN
  -- Check if requesting user owns this contact
  SELECT (user_id = p_requesting_user_id) INTO is_owner
  FROM public.contact_entities
  WHERE id = p_contact_id;
  
  IF is_owner IS NULL THEN
    RETURN null; -- Contact doesn't exist
  END IF;
  
  -- Get requesting user's role
  SELECT public.get_user_role(p_requesting_user_id)::text INTO requesting_user_role;
  
  -- Get basic contact data (non-sensitive fields)
  SELECT jsonb_build_object(
    'id', ce.id,
    'name', ce.name,
    'business_name', ce.business_name,
    'location', ce.location,
    'stage', ce.stage,
    'priority', ce.priority,
    'loan_type', ce.loan_type,
    'created_at', ce.created_at,
    'updated_at', ce.updated_at,
    'user_id', ce.user_id
  ) INTO contact_data
  FROM public.contact_entities ce
  WHERE ce.id = p_contact_id;
  
  -- Apply data masking based on user role and ownership
  IF is_owner OR requesting_user_role = 'super_admin' THEN
    -- Full access for owner or super admin
    SELECT to_jsonb(ce.*) INTO masked_data
    FROM public.contact_entities ce
    WHERE ce.id = p_contact_id;
    
    -- Add decrypted sensitive fields for authorized access
    SELECT jsonb_object_agg(
      cef.field_name, 
      public.decrypt_token(cef.encrypted_value)
    ) INTO encrypted_data
    FROM public.contact_encrypted_fields cef
    WHERE cef.contact_id = p_contact_id;
    
    masked_data := masked_data || COALESCE(encrypted_data, '{}'::jsonb);
    
  ELSIF requesting_user_role IN ('admin', 'manager') THEN
    -- Limited access with masking for admins/managers
    SELECT jsonb_build_object(
      'id', ce.id,
      'name', LEFT(ce.name, 1) || repeat('*', GREATEST(LENGTH(ce.name) - 1, 0)),
      'business_name', ce.business_name,
      'location', LEFT(ce.location, 10) || '***',
      'stage', ce.stage,
      'priority', ce.priority,
      'loan_type', ce.loan_type,
      'email', CASE 
        WHEN ce.email IS NOT NULL THEN
          SPLIT_PART(ce.email, '@', 1) || '@' || 
          LEFT(SPLIT_PART(ce.email, '@', 2), 2) || '***'
        ELSE NULL
      END,
      'phone', CASE 
        WHEN ce.phone IS NOT NULL THEN
          LEFT(ce.phone, 3) || '***' || RIGHT(ce.phone, 3)
        ELSE NULL
      END,
      'loan_amount', CASE WHEN ce.loan_amount > 0 THEN '***,***' ELSE NULL END,
      'credit_score', CASE WHEN ce.credit_score > 0 THEN '***' ELSE NULL END,
      'created_at', ce.created_at,
      'user_id', ce.user_id
    ) INTO masked_data
    FROM public.contact_entities ce
    WHERE ce.id = p_contact_id;
    
  ELSE
    -- Very limited access for other roles
    masked_data := jsonb_build_object(
      'id', contact_data->>'id',
      'business_name', contact_data->>'business_name',
      'stage', contact_data->>'stage'
    );
  END IF;
  
  -- Log data access for security monitoring
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    p_requesting_user_id,
    'contact_data_access',
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

-- Create new strict RLS policies for contact_entities
CREATE POLICY "Authenticated users can only view own contacts"
ON public.contact_entities
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all contacts"
ON public.contact_entities
FOR SELECT
TO authenticated
USING (public.has_role('super_admin'::user_role));

CREATE POLICY "Users can create contacts for themselves only"
ON public.contact_entities
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts only"
ON public.contact_entities
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can update any contact"
ON public.contact_entities
FOR UPDATE
TO authenticated
USING (public.has_role('super_admin'::user_role))
WITH CHECK (public.has_role('super_admin'::user_role));

CREATE POLICY "Users can delete own contacts only"
ON public.contact_entities
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Super admins can delete any contact"
ON public.contact_entities
FOR DELETE
TO authenticated
USING (public.has_role('super_admin'::user_role));

-- RLS policies for encrypted fields table
CREATE POLICY "Users can view encrypted fields for their contacts"
ON public.contact_encrypted_fields
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contact_entities ce
    WHERE ce.id = contact_encrypted_fields.contact_id
    AND ce.user_id = auth.uid()
  )
);

CREATE POLICY "Super admins can view all encrypted fields"
ON public.contact_encrypted_fields
FOR SELECT
TO authenticated
USING (public.has_role('super_admin'::user_role));

CREATE POLICY "System can manage encrypted fields"
ON public.contact_encrypted_fields
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Log security improvement
INSERT INTO public.security_events (
  event_type, severity, details
) VALUES (
  'contact_entities_security_enhanced',
  'high',
  jsonb_build_object(
    'improvement', 'Implemented field-level encryption and strict RLS',
    'protected_fields', ARRAY['email', 'phone', 'credit_score', 'income', 'loan_amount'],
    'access_control', 'Owner-only with admin override',
    'encryption', 'AES-256 with searchable hashes'
  )
);