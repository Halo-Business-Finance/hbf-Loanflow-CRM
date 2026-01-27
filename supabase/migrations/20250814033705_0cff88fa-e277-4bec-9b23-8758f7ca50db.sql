-- Fix the secure profile access functions

-- Drop and recreate get_masked_profile_data function
DROP FUNCTION IF EXISTS public.get_masked_profile_data(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_masked_profile_data(p_profile_id uuid, p_requesting_user_id uuid DEFAULT auth.uid())
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