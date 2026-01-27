-- Fix infinite recursion by replacing user_roles policies with non-recursive minimal policies
-- 1) Drop all existing policies on public.user_roles (fix column name)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', r.policyname);
  END LOOP;
END $$;

-- 2) Ensure RLS is enabled
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3) Minimal safe policies (no self-references)
-- Users can view their own roles
CREATE POLICY "users_view_own_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Prevent regular users from inserting/updating/deleting (optional future admin endpoints can use definer functions)
CREATE POLICY "no_user_write_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "no_user_update_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "no_user_delete_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (false);