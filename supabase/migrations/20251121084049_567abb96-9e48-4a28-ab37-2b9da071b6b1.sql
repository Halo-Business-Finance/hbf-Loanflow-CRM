-- =====================================================
-- CRITICAL FIX: Remove Conflicting Public Access Policies
-- Issue: Old public policies coexist with new secure policies
-- RLS uses OR logic - ANY permissive policy grants access
-- =====================================================

-- =====================================================
-- REMOVE ALL OLD PUBLIC POLICIES
-- =====================================================

-- Lenders table - remove public access policies
DROP POLICY IF EXISTS "Users can view all lenders" ON public.lenders;
DROP POLICY IF EXISTS "Users can create their own lenders" ON public.lenders;
DROP POLICY IF EXISTS "Users can update their own lenders" ON public.lenders;
DROP POLICY IF EXISTS "Users can delete their own lenders" ON public.lenders;
DROP POLICY IF EXISTS "Admins can update all lenders" ON public.lenders;
DROP POLICY IF EXISTS "Admins can delete all lenders" ON public.lenders;

-- Lender_contacts table - remove public access policies
DROP POLICY IF EXISTS "Users can view all lender contacts" ON public.lender_contacts;
DROP POLICY IF EXISTS "Users can create their own lender contacts" ON public.lender_contacts;
DROP POLICY IF EXISTS "Users can update their own lender contacts" ON public.lender_contacts;
DROP POLICY IF EXISTS "Users can delete their own lender contacts" ON public.lender_contacts;
DROP POLICY IF EXISTS "Admins can update all lender contacts" ON public.lender_contacts;
DROP POLICY IF EXISTS "Admins can delete all lender contacts" ON public.lender_contacts;

-- Service_providers table - remove public access policies
DROP POLICY IF EXISTS "Users can view all service providers" ON public.service_providers;
DROP POLICY IF EXISTS "Users can create their own service providers" ON public.service_providers;
DROP POLICY IF EXISTS "Users can update their own service providers" ON public.service_providers;
DROP POLICY IF EXISTS "Users can delete their own service providers" ON public.service_providers;
DROP POLICY IF EXISTS "Admins can update all service providers" ON public.service_providers;
DROP POLICY IF EXISTS "Admins can delete all service providers" ON public.service_providers;

-- =====================================================
-- VERIFY SECURE POLICIES ARE IN PLACE
-- =====================================================

-- Ensure ONLY authenticated users with roles can access these tables
-- These policies were added in previous migration and should remain

-- Verify lenders policies exist (no-op if they exist)
DO $$
BEGIN
  -- Check if secure policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'lenders' 
    AND policyname = 'Authenticated users can view lenders'
  ) THEN
    RAISE EXCEPTION 'Secure lenders policy missing - previous migration may have failed';
  END IF;
END $$;

-- Verify lender_contacts policies exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'lender_contacts' 
    AND policyname = 'Authenticated users can view lender contacts'
  ) THEN
    RAISE EXCEPTION 'Secure lender_contacts policy missing - previous migration may have failed';
  END IF;
END $$;

-- Verify service_providers policies exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'service_providers' 
    AND policyname = 'Authenticated users can view service providers'
  ) THEN
    RAISE EXCEPTION 'Secure service_providers policy missing - previous migration may have failed';
  END IF;
END $$;

-- =====================================================
-- CONFIRMATION MESSAGE
-- =====================================================

-- Log this critical security fix
INSERT INTO audit_logs (
  user_id,
  action,
  table_name,
  risk_score,
  old_values,
  new_values
) VALUES (
  auth.uid(),
  'SECURITY_FIX_REMOVE_PUBLIC_POLICIES',
  'lenders,lender_contacts,service_providers',
  100, -- Critical
  jsonb_build_object('status', 'public_access_enabled'),
  jsonb_build_object('status', 'authenticated_only', 'timestamp', now())
);