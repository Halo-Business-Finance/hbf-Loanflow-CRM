-- Fix security issues with overly permissive RLS policies (part 2)

-- First, check and drop existing problematic policies
DROP POLICY IF EXISTS "System can manage rate limits" ON public.rate_limits;
DROP POLICY IF EXISTS "System functions can manage rate limits" ON public.rate_limits;

-- Create secure rate limits policy
CREATE POLICY "Admin and system can manage rate limits" 
ON public.rate_limits 
FOR ALL 
USING (has_role('admin'::user_role) OR auth.role() = 'service_role')
WITH CHECK (has_role('admin'::user_role) OR auth.role() = 'service_role');

-- Fix security_events policies
DROP POLICY IF EXISTS "System can insert security events" ON public.security_events;
DROP POLICY IF EXISTS "System functions can insert security events" ON public.security_events;
DROP POLICY IF EXISTS "Users can view their own security events" ON public.security_events;

-- Create secure security events policies
CREATE POLICY "Authenticated users can insert security events" 
ON public.security_events 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view security events appropriately" 
ON public.security_events 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  has_role('admin'::user_role) OR 
  has_role('super_admin'::user_role)
);

-- Fix security_notifications policies
DROP POLICY IF EXISTS "System can create security notifications" ON public.security_notifications;
DROP POLICY IF EXISTS "System functions can create security notifications" ON public.security_notifications;