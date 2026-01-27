-- Make ensure_default_viewer_role robust: activate existing inactive viewer or insert if missing
CREATE OR REPLACE FUNCTION public.ensure_default_viewer_role()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- If user has no active roles at all, ensure an active 'viewer' role
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.is_active = true
  ) THEN
    -- Try to activate existing viewer role
    UPDATE public.user_roles
    SET is_active = true
    WHERE user_id = auth.uid() AND role = 'viewer'::public.user_role;

    IF NOT FOUND THEN
      -- Insert viewer role if not present; ensure idempotency via unique (user_id, role)
      INSERT INTO public.user_roles (user_id, role, is_active)
      VALUES (auth.uid(), 'viewer'::public.user_role, true)
      ON CONFLICT (user_id, role) DO UPDATE
      SET is_active = EXCLUDED.is_active;
    END IF;
  END IF;
END;
$$;