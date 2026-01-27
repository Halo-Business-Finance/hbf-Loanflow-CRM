-- Secure threat intelligence data: restrict access to admins only
-- 1) Enable and enforce RLS on threat_incidents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'threat_incidents'
  ) THEN
    RAISE EXCEPTION 'Table public.threat_incidents does not exist. Please create it before applying RLS policies.';
  END IF;
END $$;

ALTER TABLE public.threat_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threat_incidents FORCE ROW LEVEL SECURITY;

-- 2) Drop any existing overly permissive policies to prevent public reads
DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'threat_incidents'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.threat_incidents', pol.policyname);
  END LOOP;
END $$;

-- 3) Create strict policies
-- Allow system inserts (edge functions/service role bypass RLS; this also permits client inserts if needed)
CREATE POLICY "System can insert threat incidents"
ON public.threat_incidents
FOR INSERT
WITH CHECK (true);

-- Admins (and super_admins) can view
CREATE POLICY "Admins can view threat incidents"
ON public.threat_incidents
FOR SELECT
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- Admins (and super_admins) can update
CREATE POLICY "Admins can update threat incidents"
ON public.threat_incidents
FOR UPDATE
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role))
WITH CHECK (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- Admins (and super_admins) can delete
CREATE POLICY "Admins can delete threat incidents"
ON public.threat_incidents
FOR DELETE
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));