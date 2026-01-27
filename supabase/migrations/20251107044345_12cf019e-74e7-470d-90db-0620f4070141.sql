-- Enable RLS (idempotent)
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contact_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow viewing of unassigned leads for all authenticated users (for Unassigned Leads widget)
DROP POLICY IF EXISTS "Authenticated can view unassigned leads" ON public.leads;
CREATE POLICY "Authenticated can view unassigned leads"
ON public.leads FOR SELECT
TO authenticated
USING (user_id IS NULL);

-- Allow viewing of contact entities tied to unassigned leads (needed to display names/emails)
DROP POLICY IF EXISTS "Authenticated can view contact entities for unassigned leads" ON public.contact_entities;
CREATE POLICY "Authenticated can view contact entities for unassigned leads"
ON public.contact_entities FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.contact_entity_id = contact_entities.id
      AND l.user_id IS NULL
  )
);

-- Security-definer RPC to return workload-safe counts per active team member
-- This bypasses RLS safely and returns only aggregated counts
CREATE OR REPLACE FUNCTION public.get_lead_counts()
RETURNS TABLE(user_id uuid, lead_count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id AS user_id, COALESCE(COUNT(l.id), 0) AS lead_count
  FROM public.profiles p
  LEFT JOIN public.leads l ON l.user_id = p.id
  WHERE p.is_active = true
  GROUP BY p.id
$$;

GRANT EXECUTE ON FUNCTION public.get_lead_counts() TO authenticated;
