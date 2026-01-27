-- Fix account_lockouts RLS policies for maximum security

-- Drop existing policies
DROP POLICY IF EXISTS "System can create account lockouts" ON public.account_lockouts;
DROP POLICY IF EXISTS "Secure account lockouts select" ON public.account_lockouts;
DROP POLICY IF EXISTS "Admins can update account lockouts" ON public.account_lockouts;

-- Only super admins can view lockouts
CREATE POLICY "Only super admins can view lockouts"
ON public.account_lockouts
FOR SELECT
TO authenticated
USING (
  public.get_user_role(auth.uid()) = 'super_admin'::public.user_role
);

-- Only system (service_role) can create lockouts - no regular users
CREATE POLICY "Only system can create lockouts"
ON public.account_lockouts
FOR INSERT
TO service_role
WITH CHECK (true);

-- Only super admins can update lockouts (e.g., to unlock accounts)
CREATE POLICY "Only super admins can update lockouts"
ON public.account_lockouts
FOR UPDATE
TO authenticated
USING (
  public.get_user_role(auth.uid()) = 'super_admin'::public.user_role
)
WITH CHECK (
  public.get_user_role(auth.uid()) = 'super_admin'::public.user_role
);

-- Only super admins can delete lockout records
CREATE POLICY "Only super admins can delete lockouts"
ON public.account_lockouts
FOR DELETE
TO authenticated
USING (
  public.get_user_role(auth.uid()) = 'super_admin'::public.user_role
);