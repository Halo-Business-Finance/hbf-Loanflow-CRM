-- Fix unassigned leads access - restrict to managers and admins only
-- Previously any authenticated user could view unassigned leads, enabling cherry-picking

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Authenticated can view unassigned leads" ON public.leads;
DROP POLICY IF EXISTS "Team members can view unassigned leads for assignment" ON public.leads;

-- Create a proper policy that restricts unassigned leads to managers/admins only
CREATE POLICY "Managers and admins can view unassigned leads for assignment" 
ON public.leads 
FOR SELECT 
USING (
  user_id IS NULL AND (
    has_role('manager'::user_role) OR
    has_role('admin'::user_role) OR
    has_role('super_admin'::user_role)
  )
);

-- Add comment documenting the security model
COMMENT ON POLICY "Managers and admins can view unassigned leads for assignment" ON public.leads IS 
'Only managers/admins can view unassigned leads to prevent cherry-picking by regular users.';