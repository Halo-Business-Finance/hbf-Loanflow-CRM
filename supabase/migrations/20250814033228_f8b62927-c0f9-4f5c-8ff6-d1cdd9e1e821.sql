-- Complete the security notifications policy fix

-- Create secure security notifications policy for creating notifications
CREATE POLICY "Authenticated users can create their own security notifications" 
ON public.security_notifications 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Log the security fix completion
INSERT INTO public.security_events (
  user_id, event_type, severity, details
) VALUES (
  auth.uid(),
  'security_rls_policies_hardened_completed',
  'medium',
  jsonb_build_object(
    'tables_secured', ARRAY['rate_limits', 'security_events', 'security_notifications'],
    'action', 'replaced_permissive_policies_with_secure_ones',
    'impact', 'eliminated_unauthorized_data_access_vulnerabilities'
  )
);