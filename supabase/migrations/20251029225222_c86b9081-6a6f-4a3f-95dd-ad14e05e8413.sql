-- Fix security definer view issue
DROP VIEW IF EXISTS public.profiles_public;

-- Recreate view without SECURITY DEFINER (uses SECURITY INVOKER by default)
CREATE VIEW public.profiles_public AS
SELECT 
  id,
  first_name,
  last_name,
  job_title,
  city,
  state,
  language,
  timezone,
  is_active,
  created_at,
  updated_at
FROM public.profiles
WHERE can_view_public_profile(id);

-- Grant SELECT on public view to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;

COMMENT ON VIEW public.profiles_public IS 'Public view of profiles with non-sensitive fields. Uses RLS function can_view_public_profile() for access control.';