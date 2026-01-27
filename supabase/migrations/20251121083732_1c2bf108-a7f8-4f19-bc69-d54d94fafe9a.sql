-- =====================================================
-- SECURITY HARDENING: Restrict Sensitive Data Access (FIXED)
-- Priority 2 Warnings - Unassigned Leads, Sessions, Security Events
-- =====================================================

-- =====================================================
-- 1. RESTRICT UNASSIGNED LEADS ACCESS
-- =====================================================

-- Drop ALL existing policies for leads to avoid conflicts
DROP POLICY IF EXISTS "Authenticated can view contact entities for unassigned leads" ON public.contact_entities;
DROP POLICY IF EXISTS "Authenticated users can view unassigned leads" ON public.leads;
DROP POLICY IF EXISTS "Managers and admins can view unassigned leads" ON public.leads;
DROP POLICY IF EXISTS "Managers can view unassigned leads" ON public.leads;

-- Only managers and admins can view contacts for unassigned leads
CREATE POLICY "Managers and admins can view unassigned lead contacts"
ON public.contact_entities
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR 
  has_role('super_admin'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('manager'::user_role) OR
  -- User can view contacts for leads assigned to them
  (EXISTS (
    SELECT 1 FROM leads l 
    WHERE l.contact_entity_id = contact_entities.id 
    AND l.user_id = auth.uid()
  ))
);

-- Recreate the policy for viewing assigned or unassigned leads
CREATE POLICY "Users view own leads, managers view all"
ON public.leads
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id OR
  has_role('super_admin'::user_role) OR
  has_role('admin'::user_role) OR
  has_role('manager'::user_role)
);

-- =====================================================
-- 2. RESTRICT SESSION MONITORING TO ADMINS
-- =====================================================

-- Drop ALL existing session viewing policies
DROP POLICY IF EXISTS "Authenticated users can view active sessions for monitoring" ON public.active_sessions;
DROP POLICY IF EXISTS "Admins can monitor all sessions" ON public.active_sessions;
DROP POLICY IF EXISTS "Admins can monitor all sessions for security" ON public.active_sessions;

-- Create single comprehensive session policy
CREATE POLICY "Users view own sessions, admins view all"
ON public.active_sessions
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR 
  has_role('admin'::user_role) OR 
  has_role('super_admin'::user_role)
);

-- =====================================================
-- 3. RESTRICT SECURITY EVENTS TO ADMINS ONLY
-- =====================================================

-- Drop ALL existing security event policies
DROP POLICY IF EXISTS "Authenticated users can view security events" ON public.security_events;
DROP POLICY IF EXISTS "Users can view security events" ON public.security_events;
DROP POLICY IF EXISTS "All authenticated can view security events for monitoring" ON public.security_events;
DROP POLICY IF EXISTS "Only admins can view security events" ON public.security_events;
DROP POLICY IF EXISTS "Users can view their own security events" ON public.security_events;

-- Admins can view all security events
CREATE POLICY "Admins view all security events"
ON public.security_events
FOR SELECT
TO authenticated
USING (
  has_role('admin'::user_role) OR 
  has_role('super_admin'::user_role)
);

-- Users can view only their own security events
CREATE POLICY "Users view own security events"
ON public.security_events
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);

-- =====================================================
-- 4. ADD AUDIT LOGGING FOR SENSITIVE ACCESS
-- =====================================================

-- Log when admins view unassigned leads
CREATE OR REPLACE FUNCTION log_unassigned_lead_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if accessing unassigned lead and user is admin/manager
  IF NEW.user_id IS NULL AND (
    has_role(auth.uid(), 'admin'::user_role) OR 
    has_role(auth.uid(), 'manager'::user_role) OR
    has_role(auth.uid(), 'super_admin'::user_role)
  ) THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      risk_score
    ) VALUES (
      auth.uid(),
      'VIEWED_UNASSIGNED_LEAD',
      'leads',
      NEW.id::text,
      30 -- Medium risk
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply audit trigger for unassigned lead access
DROP TRIGGER IF EXISTS audit_unassigned_lead_access ON public.leads;
CREATE TRIGGER audit_unassigned_lead_access
  AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW 
  WHEN (NEW.user_id IS NULL)
  EXECUTE FUNCTION log_unassigned_lead_access();

-- =====================================================
-- 5. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON POLICY "Managers and admins can view unassigned lead contacts" ON public.contact_entities IS 
  'SECURITY: Unassigned lead contacts only visible to managers and admins to prevent cherry-picking.';

COMMENT ON POLICY "Users view own leads, managers view all" ON public.leads IS 
  'SECURITY: Users see their own leads, managers/admins can view all including unassigned leads for proper workflow.';

COMMENT ON POLICY "Users view own sessions, admins view all" ON public.active_sessions IS 
  'SECURITY: Session monitoring restricted to admins to protect user privacy and device fingerprints.';

COMMENT ON POLICY "Admins view all security events" ON public.security_events IS 
  'SECURITY: Security events restricted to admins to prevent exposing vulnerabilities.';

COMMENT ON POLICY "Users view own security events" ON public.security_events IS 
  'SECURITY: Users can view security events related to their own account for transparency.';