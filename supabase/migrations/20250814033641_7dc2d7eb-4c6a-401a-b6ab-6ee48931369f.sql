-- Create missing database functions for secure profile access

-- Create update_profile_secure function
CREATE OR REPLACE FUNCTION public.update_profile_secure(p_profile_id uuid, p_updates jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Update the profile with the provided updates
  UPDATE public.profiles 
  SET 
    first_name = COALESCE(p_updates->>'first_name', first_name),
    last_name = COALESCE(p_updates->>'last_name', last_name),
    job_title = COALESCE(p_updates->>'job_title', job_title),
    language = COALESCE(p_updates->>'language', language),
    timezone = COALESCE(p_updates->>'timezone', timezone),
    updated_at = now()
  WHERE id = p_profile_id;
  
  -- Return the updated profile
  SELECT to_jsonb(profiles.*) INTO result
  FROM public.profiles
  WHERE id = p_profile_id;
  
  RETURN result;
END;
$$;

-- Create encrypt_profile_field function if it doesn't exist
CREATE OR REPLACE FUNCTION public.encrypt_profile_field(p_profile_id uuid, p_field_name text, p_field_value text)
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
    WHEN p_field_name = 'phone_number' THEN 
      LEFT(p_field_value, 3) || '***' || RIGHT(p_field_value, 3)
    ELSE LEFT(p_field_value, 3) || repeat('*', GREATEST(LENGTH(p_field_value) - 3, 0))
  END;
  
  -- Insert or update encrypted field in the encrypted_profile_fields table
  -- Create the table if it doesn't exist
  CREATE TABLE IF NOT EXISTS public.encrypted_profile_fields (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL,
    field_name text NOT NULL,
    encrypted_value text NOT NULL,
    field_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(profile_id, field_name)
  );
  
  INSERT INTO public.encrypted_profile_fields (
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

-- Create get_masked_profile_data function if it doesn't exist properly
CREATE OR REPLACE FUNCTION public.get_masked_profile_data(p_profile_id uuid, p_requesting_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  profile_data jsonb;
  requesting_user_role text;
  is_owner boolean;
BEGIN
  -- Check if requesting user owns this profile
  SELECT (id = p_requesting_user_id) INTO is_owner
  FROM public.profiles
  WHERE id = p_profile_id;
  
  IF is_owner IS NULL THEN
    RETURN null; -- Profile doesn't exist
  END IF;
  
  -- Get requesting user's role
  SELECT public.get_user_role(p_requesting_user_id)::text INTO requesting_user_role;
  
  -- Get basic profile data
  SELECT to_jsonb(p.*) INTO profile_data
  FROM public.profiles p
  WHERE p.id = p_profile_id;
  
  -- Apply data masking based on user role and ownership
  IF is_owner OR requesting_user_role IN ('admin', 'super_admin') THEN
    -- Full access for owner or admin
    RETURN profile_data;
  ELSE
    -- Limited access - mask sensitive fields
    RETURN jsonb_build_object(
      'id', profile_data->>'id',
      'first_name', LEFT(profile_data->>'first_name', 1) || '***',
      'last_name', LEFT(profile_data->>'last_name', 1) || '***',
      'job_title', profile_data->>'job_title',
      'created_at', profile_data->>'created_at'
    );
  END IF;
END;
$$;