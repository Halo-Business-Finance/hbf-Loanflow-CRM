-- Harden security policies per findings

-- 1) ACCOUNT_LOCKOUTS: restrict strictly
ALTER TABLE public.account_lockouts ENABLE ROW LEVEL SECURITY;

-- Drop any prior policies we might have created
DROP POLICY IF EXISTS "Only super admins can view lockouts" ON public.account_lockouts;
DROP POLICY IF EXISTS "Only system can create lockouts" ON public.account_lockouts;
DROP POLICY IF EXISTS "Only super admins can update lockouts" ON public.account_lockouts;
DROP POLICY IF EXISTS "Only super admins can delete lockouts" ON public.account_lockouts;

-- Re-create definitive policies
CREATE POLICY "Only super admins can view lockouts"
ON public.account_lockouts
FOR SELECT TO authenticated
USING (public.has_role('super_admin'::public.user_role));

CREATE POLICY "Only system can create lockouts"
ON public.account_lockouts
FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Only super admins can update lockouts"
ON public.account_lockouts
FOR UPDATE TO authenticated
USING (public.has_role('super_admin'::public.user_role))
WITH CHECK (public.has_role('super_admin'::public.user_role));

CREATE POLICY "Only super admins can delete lockouts"
ON public.account_lockouts
FOR DELETE TO authenticated
USING (public.has_role('super_admin'::public.user_role));

-- 2) PROFILES: prevent public PII exposure
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles - users can view own or admins" ON public.profiles;
DROP POLICY IF EXISTS "Profiles - users can update own" ON public.profiles;

CREATE POLICY "Profiles - users can view own or admins"
ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR public.has_role('admin'::public.user_role)
  OR public.has_role('super_admin'::public.user_role)
);

CREATE POLICY "Profiles - users can update own"
ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3) PASSWORD_POLICIES: remove public readability
DO $$ BEGIN
  PERFORM 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='password_policies';
  IF FOUND THEN
    EXECUTE 'ALTER TABLE public.password_policies ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Password policies - admins can select" ON public.password_policies';
    EXECUTE 'DROP POLICY IF EXISTS "Password policies - super admins can update" ON public.password_policies';
    EXECUTE 'DROP POLICY IF EXISTS "Password policies - super admins can delete" ON public.password_policies';

    EXECUTE 'CREATE POLICY "Password policies - admins can select" ON public.password_policies FOR SELECT TO authenticated USING (public.has_role(''admin''::public.user_role) OR public.has_role(''super_admin''::public.user_role))';

    EXECUTE 'CREATE POLICY "Password policies - super admins can update" ON public.password_policies FOR UPDATE TO authenticated USING (public.has_role(''super_admin''::public.user_role)) WITH CHECK (public.has_role(''super_admin''::public.user_role))';

    EXECUTE 'CREATE POLICY "Password policies - super admins can delete" ON public.password_policies FOR DELETE TO authenticated USING (public.has_role(''super_admin''::public.user_role))';
  END IF;
END $$;