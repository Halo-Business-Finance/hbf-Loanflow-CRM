-- Implement field-level encryption and data masking for profiles table (fixed)

-- Create encrypted fields storage for sensitive profile data
CREATE TABLE IF NOT EXISTS public.profile_encrypted_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  encrypted_value text NOT NULL,
  field_hash text NOT NULL, -- For searching without decryption
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(profile_id, field_name)
);

-- Enable RLS on encrypted fields
ALTER TABLE public.profile_encrypted_fields ENABLE ROW LEVEL SECURITY;

-- Only allow access to encrypted fields by the profile owner or system functions
CREATE POLICY "Users can access their own encrypted profile fields"
ON public.profile_encrypted_fields
FOR ALL
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "System functions can manage encrypted profile fields"
ON public.profile_encrypted_fields
FOR ALL
USING (true)
WITH CHECK (true);

-- Function to encrypt and store sensitive profile fields
CREATE OR REPLACE FUNCTION public.encrypt_profile_field(
  p_profile_id uuid,
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
BEGIN
  -- Create a searchable hash (first 3 chars + masked rest)
  field_hash := LEFT(p_field_value, 3) || repeat('*', GREATEST(LENGTH(p_field_value) - 3, 0));
  
  INSERT INTO public.profile_encrypted_fields (
    profile_id, field_name, encrypted_value, field_hash
  ) VALUES (
    p_profile_id, p_field_name, public.encrypt_token(p_field_value), field_hash
  )
  ON CONFLICT (profile_id, field_name)
  DO UPDATE SET
    encrypted_value = public.encrypt_token(p_field_value),
    field_hash = field_hash,
    updated_at = now();
END;
$$;

-- Function to get masked profile data for different user roles
CREATE OR REPLACE FUNCTION public.get_masked_profile_data(
  p_profile_id uuid,
  p_requesting_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  profile_data jsonb;
  requesting_user_role text;
  is_own_profile boolean;
  masked_data jsonb := '{}'::jsonb;
  encrypted_data jsonb;
BEGIN
  -- Check if requesting user is viewing their own profile
  is_own_profile := (p_requesting_user_id = p_profile_id);
  
  -- Get requesting user's role (cast to text)
  SELECT public.get_user_role(p_requesting_user_id)::text INTO requesting_user_role;
  
  -- Get basic profile data
  SELECT to_jsonb(p.*) INTO profile_data
  FROM public.profiles p
  WHERE p.id = p_profile_id;
  
  IF profile_data IS NULL THEN
    RETURN null;
  END IF;
  
  -- Apply data masking based on user role and ownership
  IF is_own_profile OR requesting_user_role = 'super_admin' THEN
    -- Full access for own profile or super admin
    masked_data := profile_data;
    
    -- Add decrypted sensitive fields for authorized access
    SELECT jsonb_object_agg(
      pef.field_name, 
      public.decrypt_token(pef.encrypted_value)
    ) INTO encrypted_data
    FROM public.profile_encrypted_fields pef
    WHERE pef.profile_id = p_profile_id;
    
    masked_data := masked_data || COALESCE(encrypted_data, '{}'::jsonb);
    
  ELSIF requesting_user_role IN ('admin', 'manager') THEN
    -- Limited access with masking for admins/managers
    masked_data := jsonb_build_object(
      'id', profile_data->>'id',
      'first_name', LEFT(profile_data->>'first_name', 1) || repeat('*', GREATEST(LENGTH(profile_data->>'first_name') - 1, 0)),
      'last_name', LEFT(profile_data->>'last_name', 1) || repeat('*', GREATEST(LENGTH(profile_data->>'last_name') - 1, 0)),
      'email', CASE 
        WHEN profile_data->>'email' IS NOT NULL THEN
          SPLIT_PART(profile_data->>'email', '@', 1) || '@' || 
          LEFT(SPLIT_PART(profile_data->>'email', '@', 2), 2) || '***'
        ELSE NULL
      END,
      'phone_number', CASE 
        WHEN profile_data->>'phone_number' IS NOT NULL THEN
          LEFT(profile_data->>'phone_number', 3) || repeat('*', GREATEST(LENGTH(profile_data->>'phone_number') - 6, 0)) || 
          RIGHT(profile_data->>'phone_number', 3)
        ELSE NULL
      END,
      'job_title', profile_data->>'job_title',
      'created_at', profile_data->>'created_at',
      'is_active', profile_data->>'is_active'
    );
    
  ELSE
    -- Very limited access for other roles
    masked_data := jsonb_build_object(
      'id', profile_data->>'id',
      'first_name', LEFT(profile_data->>'first_name', 1) || '***',
      'job_title', profile_data->>'job_title'
    );
  END IF;
  
  -- Log data access for security monitoring
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    p_requesting_user_id,
    'profile_data_access',
    CASE 
      WHEN is_own_profile THEN 'low'
      WHEN requesting_user_role IN ('admin', 'manager') THEN 'medium'
      ELSE 'high'
    END,
    jsonb_build_object(
      'accessed_profile_id', p_profile_id,
      'requesting_user_role', requesting_user_role,
      'is_own_profile', is_own_profile,
      'data_access_level', CASE 
        WHEN is_own_profile OR requesting_user_role = 'super_admin' THEN 'full'
        WHEN requesting_user_role IN ('admin', 'manager') THEN 'masked'
        ELSE 'minimal'
      END
    )
  );
  
  RETURN masked_data;
END;
$$;