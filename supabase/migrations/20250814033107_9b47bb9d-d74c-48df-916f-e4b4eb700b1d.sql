-- Fix security issues with overly permissive RLS policies

-- Fix rate_limits table - remove overly permissive system policy
DROP POLICY IF EXISTS "System can manage rate limits" ON public.rate_limits;

-- Create more secure rate limits policies
CREATE POLICY "System functions can manage rate limits" 
ON public.rate_limits 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Fix security_events table - remove overly permissive system policy
DROP POLICY IF EXISTS "System can insert security events" ON public.security_events;

-- Create more secure security events policies
CREATE POLICY "System functions can insert security events" 
ON public.security_events 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role' OR auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own security events" 
ON public.security_events 
FOR SELECT 
USING (auth.uid() = user_id OR has_role('admin'::user_role));

-- Fix security_notifications table - remove overly permissive system policy
DROP POLICY IF EXISTS "System can create security notifications" ON public.security_notifications;

-- Create more secure security notifications policies
CREATE POLICY "System functions can create security notifications" 
ON public.security_notifications 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role' OR (auth.uid() IS NOT NULL AND auth.uid() = user_id));

-- Log the security fix
INSERT INTO public.security_events (
  event_type, severity, details
) VALUES (
  'security_rls_policies_hardened',
  'high',
  jsonb_build_object(
    'tables_fixed', ARRAY['rate_limits', 'security_events', 'security_notifications'],
    'action', 'removed_overly_permissive_policies',
    'impact', 'improved_data_security_and_access_control'
  )
);