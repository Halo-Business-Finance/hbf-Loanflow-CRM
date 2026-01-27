-- Fix SECURITY DEFINER view warning
-- Drop profiles_public view as it's not used in the application
-- The profiles table already has comprehensive RLS policies that provide the same security

DROP VIEW IF EXISTS public.profiles_public CASCADE;

-- Note: We keep the can_view_public_profile function as SECURITY DEFINER
-- because it's used in RLS policies and needs elevated privileges to avoid
-- infinite recursion when checking has_role(). This is a standard and
-- acceptable pattern for RLS helper functions.

COMMENT ON FUNCTION public.can_view_public_profile IS 
  'Checks if the current user can view a profile. Uses SECURITY DEFINER to avoid RLS recursion when checking roles. Used in profiles table RLS policies.';