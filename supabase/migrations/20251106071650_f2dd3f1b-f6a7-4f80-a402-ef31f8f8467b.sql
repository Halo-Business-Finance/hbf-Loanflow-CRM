-- Update ensure_default_viewer_role to handle ON CONFLICT properly
CREATE OR REPLACE FUNCTION public.ensure_default_viewer_role()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- If user has no active roles at all, ensure an active 'viewer' role
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
  ) THEN
    -- Insert viewer role if not present; use ON CONFLICT to activate if exists
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (auth.uid(), 'viewer'::public.user_role, true)
    ON CONFLICT (user_id, role) 
    DO UPDATE SET 
      is_active = true,
      updated_at = now();
  END IF;
END;
$function$;