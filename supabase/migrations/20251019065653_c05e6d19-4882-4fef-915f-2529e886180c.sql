-- Fix infinite recursion in user_roles RLS policy
-- The "Super admins can manage all roles" policy queries user_roles within its own policy

-- Drop the recursive policy
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;

-- Recreate using has_role() function to avoid recursion
CREATE POLICY "Super admins can manage all roles" ON public.user_roles
FOR ALL 
USING (has_role('super_admin'::user_role))
WITH CHECK (has_role('super_admin'::user_role));