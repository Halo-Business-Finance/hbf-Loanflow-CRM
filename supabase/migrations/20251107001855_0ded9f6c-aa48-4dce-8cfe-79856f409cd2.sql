-- Fix profiles RLS policies for team member viewing
-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Managers can view team profiles" ON profiles;

-- Create a new policy that allows authenticated users to view active team members
CREATE POLICY "Authenticated users can view active team profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  is_active = true 
  OR auth.uid() = id  -- Users can always see their own profile
);