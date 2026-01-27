-- Allow managers and admins to view all user roles
CREATE POLICY "Managers and admins can view all roles"
ON user_roles
FOR SELECT
TO authenticated
USING (
  has_role('manager'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('super_admin'::user_role)
);