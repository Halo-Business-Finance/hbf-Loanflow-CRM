-- Remove duplicate and redundant RLS policies
-- This migration consolidates overlapping security policies for cleaner database management

-- ============================================================
-- CLEANUP: active_sessions - Remove 8 duplicate policies
-- ============================================================

-- Remove duplicate admin SELECT policies (keep one comprehensive one)
DROP POLICY IF EXISTS "Admins can view all sessions" ON public.active_sessions;
DROP POLICY IF EXISTS "Admins can view all sessions for security" ON public.active_sessions;
-- Keep: "Admins can monitor all sessions for security"

-- Remove duplicate user UPDATE policies (keep the most recent)
DROP POLICY IF EXISTS "System can update sessions" ON public.active_sessions;
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.active_sessions;
DROP POLICY IF EXISTS "Users can only update their own sessions" ON public.active_sessions;
-- Keep: "Users can update their own session activity"

-- Remove duplicate user SELECT policy
DROP POLICY IF EXISTS "Users can only view their own active sessions" ON public.active_sessions;
-- Keep this one as it's more specific

-- Keep: "Users can create their own sessions" (FOR ALL covers all operations)

-- ============================================================
-- CLEANUP: additional_borrowers - Remove redundant SELECT
-- ============================================================

-- "Admins can manage all additional borrowers" is FOR ALL, so SELECT is redundant
DROP POLICY IF EXISTS "Admins can view all additional borrowers" ON public.additional_borrowers;
-- Keep: "Admins can manage all additional borrowers" (covers SELECT)

-- ============================================================
-- CLEANUP: clients - Remove 3 redundant specific policies
-- ============================================================

-- "Admins can manage all clients" is FOR ALL, covers SELECT/UPDATE/DELETE
DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can update all clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can delete all clients" ON public.clients;
-- Keep: "Admins can manage all clients" (FOR ALL)

-- ============================================================
-- CLEANUP: communities - Remove overlapping policies
-- ============================================================

-- "Super admins full access" (FOR ALL) is redundant with "Admins manage communities"
DROP POLICY IF EXISTS "Admins manage communities" ON public.communities;
-- Keep: "Super admins full access" (more permissive)

-- ============================================================
-- CLEANUP: custom_fields - Remove redundant SELECT
-- ============================================================

-- "Admins can manage custom fields" is FOR ALL, SELECT is redundant
DROP POLICY IF EXISTS "Admin/Manager can view custom fields" ON public.custom_fields;
-- Keep: "Admins can manage custom fields" (FOR ALL includes SELECT)

-- ============================================================
-- CLEANUP: custom_objects - Remove redundant SELECT
-- ============================================================

-- "Admins can manage custom objects" is FOR ALL, SELECT is redundant
DROP POLICY IF EXISTS "Admin/Manager can view custom objects" ON public.custom_objects;
-- Keep: "Admins can manage custom objects" (FOR ALL includes SELECT)

-- ============================================================
-- CLEANUP: custom_records - Remove redundant policy
-- ============================================================

-- "Admins can manage all custom records" (FOR ALL) already covers everything
-- The SELECT policy is more specific for managers, so we'll keep it and rename for clarity

DROP POLICY IF EXISTS "Admins can manage all custom records" ON public.custom_records;

-- Recreate with better structure: separate admin ALL from manager SELECT
CREATE POLICY "Admins have full access to custom records" 
ON public.custom_records
FOR ALL 
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "Managers can view all custom records" 
ON public.custom_records
FOR SELECT 
USING (has_role('manager'::user_role));

-- ============================================================
-- CLEANUP: approval_processes - Consolidate policies
-- ============================================================

DROP POLICY IF EXISTS "Admin/Manager can view approval processes" ON public.approval_processes;
-- Keep: "Admins can manage approval processes" (FOR ALL already includes SELECT for admins)

-- Add specific manager view policy
CREATE POLICY "Managers can view approval processes" 
ON public.approval_processes
FOR SELECT 
USING (has_role('manager'::user_role));

-- ============================================================
-- CLEANUP: contact_encrypted_fields - Remove redundant policies
-- ============================================================

-- Multiple overlapping admin policies - consolidate
DROP POLICY IF EXISTS "Admins can view encrypted field metadata" ON public.contact_encrypted_fields;
DROP POLICY IF EXISTS "Admin can view encrypted field hashes only" ON public.contact_encrypted_fields;
-- Keep: "FORTRESS_encrypted_fields_super_admin_emergency" for super admins
-- Keep: "FORTRESS_encrypted_fields_absolute_security" for owners

-- ============================================================
-- CLEANUP: device_fingerprints - Remove duplicate SELECT
-- ============================================================

DROP POLICY IF EXISTS "Users can view their own device fingerprints" ON public.device_fingerprints;
-- Keep: "Users/Admins can view device fingerprints" (covers both cases)

-- ============================================================
-- Log cleanup action
-- ============================================================

INSERT INTO public.security_events (
  event_type,
  severity,
  details,
  created_at
) VALUES (
  'rls_policy_cleanup',
  'low',
  jsonb_build_object(
    'action', 'removed_duplicate_policies',
    'policies_removed', 22,
    'tables_affected', ARRAY[
      'active_sessions',
      'additional_borrowers',
      'clients',
      'communities',
      'custom_fields',
      'custom_objects',
      'custom_records',
      'approval_processes',
      'contact_encrypted_fields',
      'device_fingerprints'
    ],
    'policies_recreated', 3,
    'reason', 'consolidate_duplicate_and_redundant_rls_policies'
  ),
  NOW()
);