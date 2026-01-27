-- Fix only the security notifications policies that are causing security warnings

-- Remove the overly permissive policy for security notifications
DROP POLICY IF EXISTS "System can create security notifications" ON public.security_notifications;

-- Create a more secure policy for security notifications
CREATE POLICY "Secure security notification creation" 
ON public.security_notifications 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid() = user_id
);

-- Ensure only admins can manage security notifications
CREATE POLICY "Admins can manage security notifications" 
ON public.security_notifications 
FOR ALL 
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role))
WITH CHECK (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- Log the security improvement
INSERT INTO public.security_events (
  event_type, severity, details, user_id
) VALUES (
  'security_notifications_access_secured',
  'medium',
  jsonb_build_object(
    'action', 'removed_overly_permissive_notification_policies',
    'impact', 'notifications_now_require_proper_authentication'
  ),
  auth.uid()
);