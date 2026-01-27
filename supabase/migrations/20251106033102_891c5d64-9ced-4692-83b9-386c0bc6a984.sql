-- Update get_accessible_leads to include 'viewer' role access
CREATE OR REPLACE FUNCTION public.get_accessible_leads()
RETURNS SETOF public.leads
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT l.*
  FROM public.leads l
  WHERE l.user_id = auth.uid()
     OR public.has_any_role(auth.uid(), ARRAY['admin','super_admin','manager','viewer']::public.user_role[]);
$$;