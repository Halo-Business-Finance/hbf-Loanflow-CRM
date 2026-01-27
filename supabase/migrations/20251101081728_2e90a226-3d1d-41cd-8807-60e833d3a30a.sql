
-- ============================================================================
-- GLOBAL ADMIN ACCESS POLICIES FOR CRM
-- Ensures super_admin and admin roles have complete access to all CRM data
-- ============================================================================

-- 1. CASES TABLE - Add missing admin policies
DROP POLICY IF EXISTS "Global admin access to cases" ON public.cases;
CREATE POLICY "Global admin access to cases"
ON public.cases
FOR ALL
TO authenticated
USING (
  has_role('super_admin'::user_role) OR has_role('admin'::user_role)
)
WITH CHECK (
  has_role('super_admin'::user_role) OR has_role('admin'::user_role)
);

-- 2. ADDITIONAL_BORROWERS - Strengthen admin access  
DROP POLICY IF EXISTS "Global admin access to additional_borrowers" ON public.additional_borrowers;
CREATE POLICY "Global admin access to additional_borrowers"
ON public.additional_borrowers
FOR ALL
TO authenticated
USING (
  has_role('super_admin'::user_role) OR has_role('admin'::user_role)
)
WITH CHECK (
  has_role('super_admin'::user_role) OR has_role('admin'::user_role)
);

-- 3. CASE_COMMENTS - Add admin access
DROP POLICY IF EXISTS "Global admin access to case_comments" ON public.case_comments;
CREATE POLICY "Global admin access to case_comments"
ON public.case_comments
FOR ALL
TO authenticated
USING (
  has_role('super_admin'::user_role) OR has_role('admin'::user_role)
)
WITH CHECK (
  has_role('super_admin'::user_role) OR has_role('admin'::user_role)
);

-- 4. COMMUNITY_MEMBERS - Add admin access
DROP POLICY IF EXISTS "Global admin access to community_members" ON public.community_members;
CREATE POLICY "Global admin access to community_members"
ON public.community_members
FOR ALL
TO authenticated
USING (
  has_role('super_admin'::user_role) OR has_role('admin'::user_role)
)
WITH CHECK (
  has_role('super_admin'::user_role) OR has_role('admin'::user_role)
);

-- 5. EMAIL_ACCOUNTS - Add admin override
DROP POLICY IF EXISTS "Global admin access to email_accounts" ON public.email_accounts;
CREATE POLICY "Global admin access to email_accounts"
ON public.email_accounts
FOR ALL
TO authenticated
USING (
  has_role('super_admin'::user_role) OR has_role('admin'::user_role)
)
WITH CHECK (
  has_role('super_admin'::user_role) OR has_role('admin'::user_role)
);

-- Create helper function to verify admin access (using correct signature)
CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('super_admin'::user_role, auth.uid()) 
      OR has_role('admin'::user_role, auth.uid());
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_global_admin() TO authenticated;

COMMENT ON FUNCTION public.is_global_admin() IS 'Helper function to check if current user is a global admin (super_admin or admin role)';
