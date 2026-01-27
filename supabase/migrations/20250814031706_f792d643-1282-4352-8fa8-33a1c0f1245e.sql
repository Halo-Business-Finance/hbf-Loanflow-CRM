-- Fix session creation policy to allow users to create their own sessions
DROP POLICY IF EXISTS "Secure session creation only" ON public.active_sessions;

-- Create proper session creation policy
CREATE POLICY "Users can create their own sessions" 
ON public.active_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Ensure session cleanup works properly by allowing users to deactivate sessions
DROP POLICY IF EXISTS "Users can deactivate their own sessions" ON public.active_sessions;

CREATE POLICY "Users can manage their own sessions" 
ON public.active_sessions 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Log the security fix
INSERT INTO public.security_events (
  event_type, severity, details
) VALUES (
  'session_rls_policy_fixed',
  'medium',
  jsonb_build_object(
    'table', 'active_sessions',
    'action', 'fixed_restrictive_policies',
    'impact', 'resolved_session_validation_failures'
  )
);