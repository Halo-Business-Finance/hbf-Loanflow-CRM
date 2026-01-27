-- Fix support_tickets RLS policies to use has_role() function with correct signature
-- The has_role function signature is: has_role(required_role user_role, user_id uuid DEFAULT auth.uid())

-- Drop existing admin policies
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can update all tickets" ON public.support_tickets;

-- Recreate admin policies using has_role() function with correct parameter order
CREATE POLICY "Admins can view all tickets"
  ON public.support_tickets
  FOR SELECT
  USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "Admins can update all tickets"
  ON public.support_tickets
  FOR UPDATE
  USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));