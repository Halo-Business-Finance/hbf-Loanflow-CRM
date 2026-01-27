-- Fix SECURITY DEFINER view warning by dropping unused profiles_public view
-- The view is not used anywhere in the application code
-- The profiles table already has comprehensive RLS policies that provide the same security

DROP VIEW IF EXISTS public.profiles_public CASCADE;

-- Note: We keep the can_view_public_profile function as SECURITY DEFINER
-- because it's used in RLS policies and needs elevated privileges to avoid recursion
-- The function has proper security checks: users can only see their own profiles,
-- admins can see all, and team members can see each other within communities