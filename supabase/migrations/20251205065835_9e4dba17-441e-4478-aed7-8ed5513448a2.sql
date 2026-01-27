-- Fix contact_entities RLS policies - consolidate redundant policies and add session validation

-- Drop existing redundant SELECT policies
DROP POLICY IF EXISTS "Admins and super admins can view all contacts" ON public.contact_entities;
DROP POLICY IF EXISTS "Extended roles can view contacts" ON public.contact_entities;
DROP POLICY IF EXISTS "Managers and admins can view all contact entities" ON public.contact_entities;
DROP POLICY IF EXISTS "Managers and admins can view unassigned lead contacts" ON public.contact_entities;
DROP POLICY IF EXISTS "Users can view own contacts only" ON public.contact_entities;
DROP POLICY IF EXISTS "Users can view their own contact entities" ON public.contact_entities;

-- Drop existing redundant UPDATE policies
DROP POLICY IF EXISTS "Managers and admins can update all contact entities" ON public.contact_entities;
DROP POLICY IF EXISTS "Users can update own contacts only" ON public.contact_entities;
DROP POLICY IF EXISTS "Users can update their own contact entities" ON public.contact_entities;

-- Drop existing redundant DELETE policies  
DROP POLICY IF EXISTS "Managers and admins can delete all contact entities" ON public.contact_entities;
DROP POLICY IF EXISTS "Users can delete own contacts only" ON public.contact_entities;
DROP POLICY IF EXISTS "Users can delete their own contact entities" ON public.contact_entities;

-- Drop existing redundant INSERT policies
DROP POLICY IF EXISTS "Users can create own contacts only" ON public.contact_entities;
DROP POLICY IF EXISTS "Users can insert their own contact entities" ON public.contact_entities;

-- Drop super admin full access (will recreate with session validation)
DROP POLICY IF EXISTS "Super admins have full contact access" ON public.contact_entities;

-- Create consolidated SELECT policy with session validation
CREATE POLICY "contact_entities_select_policy"
  ON public.contact_entities
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      -- Users can view their own contacts
      auth.uid() = user_id
      -- Admins and managers can view all contacts
      OR has_role('super_admin'::user_role)
      OR has_role('admin'::user_role)
      OR has_role('manager'::user_role)
      -- Extended roles can view contacts (for operational purposes)
      OR has_any_role(auth.uid(), ARRAY['loan_processor'::user_role, 'underwriter'::user_role, 'funder'::user_role, 'closer'::user_role, 'loan_originator'::user_role])
    )
  );

-- Create consolidated INSERT policy
CREATE POLICY "contact_entities_insert_policy"
  ON public.contact_entities
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      -- Users can only create contacts for themselves
      auth.uid() = user_id
      -- Super admins can create for anyone
      OR has_role('super_admin'::user_role)
    )
  );

-- Create consolidated UPDATE policy
CREATE POLICY "contact_entities_update_policy"
  ON public.contact_entities
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      -- Users can update their own contacts
      auth.uid() = user_id
      -- Admins and managers can update all
      OR has_role('super_admin'::user_role)
      OR has_role('admin'::user_role)
      OR has_role('manager'::user_role)
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      auth.uid() = user_id
      OR has_role('super_admin'::user_role)
      OR has_role('admin'::user_role)
      OR has_role('manager'::user_role)
    )
  );

-- Create consolidated DELETE policy
CREATE POLICY "contact_entities_delete_policy"
  ON public.contact_entities
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND (
      -- Users can delete their own contacts
      auth.uid() = user_id
      -- Admins and managers can delete all
      OR has_role('super_admin'::user_role)
      OR has_role('admin'::user_role)
      OR has_role('manager'::user_role)
    )
  );

-- Add comment documenting the security model
COMMENT ON TABLE public.contact_entities IS 'Contact entities with consolidated RLS policies requiring authentication. Sensitive fields (credit_score, income, loan_amount) should use field-level encryption via contact_encrypted_fields table.';