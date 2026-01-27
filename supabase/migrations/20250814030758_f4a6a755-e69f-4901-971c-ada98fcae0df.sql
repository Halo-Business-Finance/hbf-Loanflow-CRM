-- Fix RLS policies for communities table to prevent unauthorized access

-- Drop existing policies first
DROP POLICY IF EXISTS "Admins can manage communities" ON public.communities;
DROP POLICY IF EXISTS "Users can view communities they're members of" ON public.communities;

-- Create secure RLS policies for communities table

-- 1. Super admins can manage all communities
CREATE POLICY "Super admins can manage all communities" 
ON public.communities 
FOR ALL 
USING (has_role('super_admin'::user_role))
WITH CHECK (has_role('super_admin'::user_role));

-- 2. Admins can view and manage communities
CREATE POLICY "Admins can manage communities" 
ON public.communities 
FOR ALL 
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role))
WITH CHECK (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- 3. Users can only view communities they are members of (fixed the join condition)
CREATE POLICY "Users can view communities they are members of" 
ON public.communities 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.community_members cm
    WHERE cm.community_id = communities.id 
      AND (
        cm.user_id = auth.uid() 
        OR EXISTS (
          SELECT 1 
          FROM public.clients c 
          WHERE c.id = cm.client_id 
            AND c.user_id = auth.uid()
        )
      )
      AND cm.status = 'active'
  )
);

-- 4. Community moderators can update their communities
CREATE POLICY "Community moderators can update communities" 
ON public.communities 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.community_members cm
    WHERE cm.community_id = communities.id 
      AND cm.user_id = auth.uid()
      AND cm.role IN ('moderator', 'admin')
      AND cm.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.community_members cm
    WHERE cm.community_id = communities.id 
      AND cm.user_id = auth.uid()
      AND cm.role IN ('moderator', 'admin')
      AND cm.status = 'active'
  )
);

-- 5. Only admins can create new communities
CREATE POLICY "Only admins can create communities" 
ON public.communities 
FOR INSERT 
WITH CHECK (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- 6. Only admins and super admins can delete communities
CREATE POLICY "Only admins can delete communities" 
ON public.communities 
FOR DELETE 
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));