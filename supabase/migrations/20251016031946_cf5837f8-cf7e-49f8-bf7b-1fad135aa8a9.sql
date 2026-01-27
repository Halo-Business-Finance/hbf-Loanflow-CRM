-- Drop redundant/conflicting policies on user_roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role viewing for authorized users" ON public.user_roles;
DROP POLICY IF EXISTS "Secure user roles access" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can view all user roles" ON public.user_roles;

-- Create a simple, clean policy for users to view their own roles (no has_role dependency)
CREATE POLICY "users_view_own_roles_simple" 
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create a clean policy for admins and super_admins to view all roles
CREATE POLICY "admins_view_all_roles_clean"
ON public.user_roles
FOR SELECT
TO authenticated  
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
    AND ur.is_active = true
  )
);