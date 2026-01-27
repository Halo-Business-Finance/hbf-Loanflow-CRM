-- Fix overly permissive RLS policies for security hardening

-- Drop the policy that allows all authenticated users to view ALL security events
-- Users can still see their own events via "Users can view their own security events" policy
-- Admins can see all events via existing admin policies
DROP POLICY IF EXISTS "Authenticated users can view security events for monitoring" ON security_events;

-- Drop the policy that allows all authenticated users to view ALL user roles
-- Users can still see their own roles via "Users can view their own roles" policy
-- Admins can see all roles via existing admin policies
DROP POLICY IF EXISTS "Authenticated users can view all user roles" ON user_roles;