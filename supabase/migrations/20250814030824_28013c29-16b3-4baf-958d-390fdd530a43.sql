-- First, drop ALL existing policies on communities table to ensure clean state
DROP POLICY IF EXISTS "Super admins can manage all communities" ON public.communities;
DROP POLICY IF EXISTS "Admins can manage communities" ON public.communities;
DROP POLICY IF EXISTS "Users can view communities they're members of" ON public.communities;
DROP POLICY IF EXISTS "Community moderators can update communities" ON public.communities;
DROP POLICY IF EXISTS "Only admins can create communities" ON public.communities;
DROP POLICY IF EXISTS "Only admins can delete communities" ON public.communities;

-- Now create the secure RLS policies

-- 1. Super admins have full access
CREATE POLICY "Super admins full access" 
ON public.communities 
FOR ALL 
USING (has_role('super_admin'::user_role))
WITH CHECK (has_role('super_admin'::user_role));

-- 2. Admins can manage communities (but not override super admin)
CREATE POLICY "Admins manage communities" 
ON public.communities 
FOR ALL 
USING (has_role('admin'::user_role))
WITH CHECK (has_role('admin'::user_role));

-- 3. Users can only view communities they are active members of
CREATE POLICY "Members can view their communities" 
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
CREATE POLICY "Moderators can update communities" 
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

-- Log security enhancement
INSERT INTO public.security_events (
  event_type, severity, details
) VALUES (
  'rls_policy_updated',
  'medium',
  jsonb_build_object(
    'table', 'communities',
    'action', 'comprehensive_rls_security_fix',
    'policies_created', 4
  )
);