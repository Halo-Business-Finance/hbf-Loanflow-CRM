-- Secure threat_incidents table with strict RLS policies
-- 1) Enable RLS and drop any existing policies safely
DO $$
BEGIN
  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    JOIN pg_namespace n ON n.nspname = t.schemaname
    WHERE t.schemaname = 'public' AND t.tablename = 'threat_incidents'
  ) THEN
    RAISE EXCEPTION 'Table public.threat_incidents does not exist';
  END IF;
END $$;

ALTER TABLE public.threat_incidents ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN (
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'threat_incidents'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.threat_incidents', p.policyname);
  END LOOP;
END $$;

-- 2) Create strict policies
-- Admins (and super_admins) can view
CREATE POLICY "Admins can view threat incidents"
ON public.threat_incidents
FOR SELECT
USING (
  has_role('admin'::user_role) OR has_role('super_admin'::user_role)
);

-- Admins (and super_admins) can update
CREATE POLICY "Admins can update threat incidents"
ON public.threat_incidents
FOR UPDATE
USING (
  has_role('admin'::user_role) OR has_role('super_admin'::user_role)
)
WITH CHECK (
  has_role('admin'::user_role) OR has_role('super_admin'::user_role)
);

-- Admins (and super_admins) can delete
CREATE POLICY "Admins can delete threat incidents"
ON public.threat_incidents
FOR DELETE
USING (
  has_role('admin'::user_role) OR has_role('super_admin'::user_role)
);

-- Allow inserts by system paths (edge functions/service role/SECURITY DEFINER fns)
-- Note: service role and SECURITY DEFINER functions bypass RLS; this policy
-- ensures authenticated app users cannot read but doesn't block system inserts.
CREATE POLICY "System can insert threat incidents"
ON public.threat_incidents
FOR INSERT
WITH CHECK (true);
