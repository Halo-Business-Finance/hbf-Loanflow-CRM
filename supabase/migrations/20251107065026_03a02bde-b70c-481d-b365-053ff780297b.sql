-- Add policies to allow authenticated users to view security monitoring data
-- This is appropriate for internal security dashboards where trusted team members 
-- need visibility into system security metrics

-- Allow authenticated users to view security events for monitoring
CREATE POLICY "Authenticated users can view security events for monitoring"
ON public.security_events
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to view active sessions for monitoring
CREATE POLICY "Authenticated users can view active sessions for monitoring"
ON public.active_sessions
FOR SELECT
TO authenticated
USING (true);
