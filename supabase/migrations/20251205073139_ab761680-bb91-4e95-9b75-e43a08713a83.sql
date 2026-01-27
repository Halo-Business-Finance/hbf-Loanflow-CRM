-- ============================================
-- SECURITY FIXES: Moderate Issues & Business Decision
-- ============================================

-- 1. Make document-templates bucket private
UPDATE storage.buckets 
SET public = false 
WHERE name = 'document-templates';

-- 2. Create secure view for email_accounts (excludes OAuth tokens)
CREATE OR REPLACE VIEW public.email_accounts_secure AS
SELECT 
  id,
  user_id,
  email_address,
  display_name,
  expires_at,
  is_active,
  created_at,
  updated_at
FROM public.email_accounts;

-- Grant access to the secure view
GRANT SELECT ON public.email_accounts_secure TO authenticated;

-- Add comment to the view
COMMENT ON VIEW public.email_accounts_secure IS 'Secure view of email_accounts excluding OAuth tokens. Use this view for all client-side queries.';

-- 3. Restrict contact_entities access to only contacts linked to assigned leads
-- First, drop the overly permissive policy
DROP POLICY IF EXISTS "contact_entities_select_policy" ON public.contact_entities;

-- Create a more restrictive policy that limits loan processing roles to assigned leads
CREATE POLICY "contact_entities_secure_select_policy" ON public.contact_entities
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    -- Owner can always see their own contacts
    auth.uid() = user_id
    -- Super admin, admin, manager have full access for oversight
    OR has_role('super_admin'::user_role)
    OR has_role('admin'::user_role)
    OR has_role('manager'::user_role)
    -- Loan processing roles can only see contacts linked to leads they own
    OR (
      has_any_role(auth.uid(), ARRAY['loan_processor', 'underwriter', 'funder', 'closer', 'loan_originator']::user_role[])
      AND (
        -- Contact is linked as a borrower on a lead the user owns
        EXISTS (
          SELECT 1 FROM public.additional_borrowers ab
          JOIN public.leads l ON l.id = ab.lead_id
          WHERE ab.contact_entity_id = contact_entities.id
          AND l.user_id = auth.uid()
        )
        -- Or the contact is directly the lead's primary contact
        OR EXISTS (
          SELECT 1 FROM public.leads l
          WHERE l.contact_entity_id = contact_entities.id
          AND l.user_id = auth.uid()
        )
        -- Or contact was created by the user
        OR user_id = auth.uid()
      )
    )
  )
);

-- Add comments documenting the security model
COMMENT ON TABLE public.contact_entities IS 'Contact access: Owners see own, managers+ see all, loan processing roles see only contacts linked to their assigned leads';
COMMENT ON TABLE public.email_accounts IS 'Email accounts with OAuth tokens. Use email_accounts_secure view for client queries to avoid token exposure';