-- =====================================================
-- CRITICAL SECURITY FIX: Secure Public Tables
-- Tables: lenders, lender_contacts, service_providers
-- Issue: Currently allow public access to sensitive data
-- =====================================================

-- Ensure RLS is enabled on all three tables
ALTER TABLE public.lenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lender_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- LENDERS TABLE POLICIES
-- =====================================================

-- Drop any existing overly permissive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.lenders;
DROP POLICY IF EXISTS "Public lenders are viewable by everyone" ON public.lenders;

-- Only authenticated users with appropriate roles can view lenders
CREATE POLICY "Authenticated users can view lenders"
ON public.lenders
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
);

-- Only loan originators, managers, and admins can create lenders
CREATE POLICY "Authorized roles can create lenders"
ON public.lenders
FOR INSERT
TO authenticated
WITH CHECK (
  has_role('super_admin'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('manager'::user_role) OR
  has_role('loan_originator'::user_role)
);

-- Only admins and managers can update lenders
CREATE POLICY "Admins and managers can update lenders"
ON public.lenders
FOR UPDATE
TO authenticated
USING (
  has_role('super_admin'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('manager'::user_role)
)
WITH CHECK (
  has_role('super_admin'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('manager'::user_role)
);

-- Only super admins can delete lenders
CREATE POLICY "Only super admins can delete lenders"
ON public.lenders
FOR DELETE
TO authenticated
USING (
  has_role('super_admin'::user_role)
);

-- =====================================================
-- LENDER_CONTACTS TABLE POLICIES
-- =====================================================

-- Drop any existing overly permissive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.lender_contacts;
DROP POLICY IF EXISTS "Public lender contacts are viewable by everyone" ON public.lender_contacts;

-- Only authenticated users can view lender contacts
CREATE POLICY "Authenticated users can view lender contacts"
ON public.lender_contacts
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
);

-- Only authorized roles can create lender contacts
CREATE POLICY "Authorized roles can create lender contacts"
ON public.lender_contacts
FOR INSERT
TO authenticated
WITH CHECK (
  has_role('super_admin'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('manager'::user_role) OR
  has_role('loan_originator'::user_role)
);

-- Only admins and managers can update lender contacts
CREATE POLICY "Admins and managers can update lender contacts"
ON public.lender_contacts
FOR UPDATE
TO authenticated
USING (
  has_role('super_admin'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('manager'::user_role)
)
WITH CHECK (
  has_role('super_admin'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('manager'::user_role)
);

-- Only super admins can delete lender contacts
CREATE POLICY "Only super admins can delete lender contacts"
ON public.lender_contacts
FOR DELETE
TO authenticated
USING (
  has_role('super_admin'::user_role)
);

-- =====================================================
-- SERVICE_PROVIDERS TABLE POLICIES
-- =====================================================

-- Drop any existing overly permissive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.service_providers;
DROP POLICY IF EXISTS "Public service providers are viewable by everyone" ON public.service_providers;

-- Only authenticated users can view service providers
CREATE POLICY "Authenticated users can view service providers"
ON public.service_providers
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
);

-- Only authorized roles can create service providers
CREATE POLICY "Authorized roles can create service providers"
ON public.service_providers
FOR INSERT
TO authenticated
WITH CHECK (
  has_role('super_admin'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('manager'::user_role) OR
  has_role('loan_originator'::user_role)
);

-- Only admins and managers can update service providers
CREATE POLICY "Admins and managers can update service providers"
ON public.service_providers
FOR UPDATE
TO authenticated
USING (
  has_role('super_admin'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('manager'::user_role)
)
WITH CHECK (
  has_role('super_admin'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('manager'::user_role)
);

-- Only super admins can delete service providers
CREATE POLICY "Only super admins can delete service providers"
ON public.service_providers
FOR DELETE
TO authenticated
USING (
  has_role('super_admin'::user_role)
);

-- =====================================================
-- AUDIT LOGGING
-- =====================================================

-- Log all modifications to these sensitive tables
CREATE OR REPLACE FUNCTION log_sensitive_partner_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    risk_score
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    50 -- Medium-high risk score for partner data changes
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply audit triggers
DROP TRIGGER IF EXISTS audit_lenders_changes ON public.lenders;
CREATE TRIGGER audit_lenders_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.lenders
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_partner_changes();

DROP TRIGGER IF EXISTS audit_lender_contacts_changes ON public.lender_contacts;
CREATE TRIGGER audit_lender_contacts_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.lender_contacts
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_partner_changes();

DROP TRIGGER IF EXISTS audit_service_providers_changes ON public.service_providers;
CREATE TRIGGER audit_service_providers_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.service_providers
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_partner_changes();

-- Add comments for documentation
COMMENT ON POLICY "Authenticated users can view lenders" ON public.lenders IS 
  'SECURITY: Requires authentication. No public access to sensitive lender data.';
COMMENT ON POLICY "Authenticated users can view lender contacts" ON public.lender_contacts IS 
  'SECURITY: Requires authentication. No public access to contact information.';
COMMENT ON POLICY "Authenticated users can view service providers" ON public.service_providers IS 
  'SECURITY: Requires authentication. No public access to service provider data.';