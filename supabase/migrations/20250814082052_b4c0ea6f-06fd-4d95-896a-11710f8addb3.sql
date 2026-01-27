-- Assign super_admin role to the current authenticated user
INSERT INTO public.user_roles (user_id, role)
SELECT auth.uid(), 'super_admin'::user_role
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;