-- Remove duplicate policy that might be causing confusion
DROP POLICY IF EXISTS "Users can view communities they are members of" ON public.communities;

-- Add missing INSERT and DELETE policies for complete security coverage

-- 5. Only admins can create new communities
CREATE POLICY "Admins can create communities" 
ON public.communities 
FOR INSERT 
WITH CHECK (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- 6. Only super admins can delete communities (most restrictive)
CREATE POLICY "Super admins can delete communities" 
ON public.communities 
FOR DELETE 
USING (has_role('super_admin'::user_role));

-- Log final security enhancement
INSERT INTO public.security_events (
  event_type, severity, details
) VALUES (
  'communities_rls_secured',
  'low',
  jsonb_build_object(
    'table', 'communities',
    'action', 'rls_policies_completed',
    'security_level', 'enterprise_grade'
  )
);