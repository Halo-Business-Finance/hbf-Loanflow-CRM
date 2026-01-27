-- Allow managers and admins to view audit logs in addition to super_admins
DROP POLICY IF EXISTS "Only super admins can view audit logs" ON audit_logs;

CREATE POLICY "Managers and admins can view audit logs"
ON audit_logs
FOR SELECT
TO authenticated
USING (
  has_role('super_admin'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('manager'::user_role)
);