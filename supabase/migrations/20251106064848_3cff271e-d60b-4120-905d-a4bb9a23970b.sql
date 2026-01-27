-- Fix RLS: Allow users to view their own roles and admins to view all roles
CREATE POLICY "Users can view own roles and admins view all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::public.user_role[])
);

-- Grant necessary permissions
GRANT SELECT ON public.user_roles TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_viewer_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, user_role[]) TO authenticated;