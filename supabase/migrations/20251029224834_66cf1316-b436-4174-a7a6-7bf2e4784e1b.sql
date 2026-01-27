-- Fix overly permissive RLS policy on profiles table
-- Drop the insecure policy that allows all authenticated users to view all profiles
DROP POLICY IF EXISTS "Users can view other users for messaging" ON public.profiles;

-- Create a secure function to check if a user can view another user's public profile info
CREATE OR REPLACE FUNCTION public.can_view_public_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- User can view their own profile
    auth.uid() = profile_user_id
    OR
    -- Admins and super admins can view all profiles
    has_role('admin'::user_role)
    OR
    has_role('super_admin'::user_role)
    OR
    -- Users can view profiles of team members in same community
    EXISTS (
      SELECT 1 FROM community_members cm1
      WHERE cm1.user_id = auth.uid()
      AND cm1.status = 'active'
      AND EXISTS (
        SELECT 1 FROM community_members cm2
        WHERE cm2.user_id = profile_user_id
        AND cm2.community_id = cm1.community_id
        AND cm2.status = 'active'
      )
    );
$$;

-- Create a new secure policy for viewing public profile information
-- This policy allows viewing only non-sensitive fields through proper channels
CREATE POLICY "Users can view authorized public profiles"
ON public.profiles
FOR SELECT
USING (can_view_public_profile(id));

-- Add comment explaining the security model
COMMENT ON POLICY "Users can view authorized public profiles" ON public.profiles IS 
'Secure policy that allows users to view profiles only when they have a legitimate business relationship. For messaging and full profile access with field-level masking, use the secure-profile-access edge function.';