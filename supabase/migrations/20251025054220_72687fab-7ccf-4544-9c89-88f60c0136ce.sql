-- Backfill a default viewer role for all existing users without any role
INSERT INTO public.user_roles (user_id, role, is_active)
SELECT u.id, 'viewer'::public.user_role, true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
);

-- Secure helper to fetch accessible leads for the current user
CREATE OR REPLACE FUNCTION public.get_accessible_leads()
RETURNS SETOF public.leads
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.*
  FROM public.leads l
  WHERE l.user_id = auth.uid()
     OR public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager']::public.user_role[]);
$$;