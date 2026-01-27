-- Ensure RLS visibility for verifying own roles (fixes auto-repair verification)
-- This migration is safe and additive: it only adds SELECT policies without altering write access.

-- Enable RLS on user_roles (no-op if already enabled)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own active roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role('admin'::public.user_role)
  OR public.has_role('super_admin'::public.user_role)
);

-- Optional: tighten default by ensuring there is at least one SELECT policy (PostgreSQL ORs policies)
-- No changes to INSERT/UPDATE/DELETE to avoid privilege escalation.
