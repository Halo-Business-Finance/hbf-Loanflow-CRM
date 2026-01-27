-- Simplify leads RLS policies to fix data visibility issue
-- The complex has_any_role checks may be causing silent failures

-- Drop ALL existing leads SELECT policies  
DROP POLICY IF EXISTS "Role-based leads access" ON leads;
DROP POLICY IF EXISTS "Admins can view all leads" ON leads;
DROP POLICY IF EXISTS "Super admins can view all leads" ON leads;
DROP POLICY IF EXISTS "Managers and admins can view unassigned leads" ON leads;

-- Create a single, simple, comprehensive SELECT policy
-- All authenticated users with any active role can view all leads
CREATE POLICY "Authenticated users with roles can view all leads"
ON leads
FOR SELECT
TO authenticated
USING (
  -- User owns the lead
  auth.uid() = user_id
  OR
  -- OR user has any active role (most users should see all leads for collaboration)
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND is_active = true
  )
);