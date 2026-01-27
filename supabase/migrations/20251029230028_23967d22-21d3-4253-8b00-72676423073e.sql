-- Fix RLS policy to allow managers and admins to view unassigned leads
-- Add a specific policy for viewing unassigned leads (where user_id IS NULL)

CREATE POLICY "Managers and admins can view unassigned leads"
ON public.leads
FOR SELECT
USING (
  user_id IS NULL 
  AND (
    has_role('manager'::user_role) 
    OR has_role('admin'::user_role) 
    OR has_role('super_admin'::user_role)
  )
);

COMMENT ON POLICY "Managers and admins can view unassigned leads" ON public.leads IS 
'Allows managers, admins, and super admins to view leads that have not been assigned to any user (user_id IS NULL). This is essential for the lead assignment functionality.';