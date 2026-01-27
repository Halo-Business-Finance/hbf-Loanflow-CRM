-- Drop ALL existing policies on account_lockouts
DROP POLICY IF EXISTS "System can create account lockouts" ON public.account_lockouts;
DROP POLICY IF EXISTS "Secure account lockouts select" ON public.account_lockouts;
DROP POLICY IF EXISTS "Admins can update account lockouts" ON public.account_lockouts;
DROP POLICY IF EXISTS "Only super admins can view lockouts" ON public.account_lockouts;
DROP POLICY IF EXISTS "Only system can create lockouts" ON public.account_lockouts;
DROP POLICY IF EXISTS "Only super admins can update lockouts" ON public.account_lockouts;
DROP POLICY IF EXISTS "Only super admins can delete lockouts" ON public.account_lockouts;

-- Create new secure policies
CREATE POLICY "Only super admins can view lockouts"
ON public.account_lockouts FOR SELECT TO authenticated
USING (public.has_role('super_admin'::public.user_role));

CREATE POLICY "Only system can create lockouts"
ON public.account_lockouts FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Only super admins can update lockouts"
ON public.account_lockouts FOR UPDATE TO authenticated
USING (public.has_role('super_admin'::public.user_role))
WITH CHECK (public.has_role('super_admin'::public.user_role));

CREATE POLICY "Only super admins can delete lockouts"
ON public.account_lockouts FOR DELETE TO authenticated
USING (public.has_role('super_admin'::public.user_role));