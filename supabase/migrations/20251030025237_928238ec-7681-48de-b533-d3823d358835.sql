-- Drop the restrictive policy if it exists
DROP POLICY IF EXISTS "Managers and admins can view all roles" ON user_roles;

-- Allow all authenticated users to view user roles
-- User roles are organizational metadata needed throughout the app
CREATE POLICY "Authenticated users can view all user roles"
ON user_roles
FOR SELECT
TO authenticated
USING (true);