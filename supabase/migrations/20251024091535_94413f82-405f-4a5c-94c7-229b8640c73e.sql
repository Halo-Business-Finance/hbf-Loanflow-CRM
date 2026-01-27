-- Drop existing admin policies if they exist
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can manage all leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can view all documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Admins can manage all documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Admins can view all additional borrowers" ON public.additional_borrowers;
DROP POLICY IF EXISTS "Admins can view encrypted field metadata" ON public.contact_encrypted_fields;

-- Update contact_entities policies to allow admin/super admin access
DROP POLICY IF EXISTS "Admins can view all contacts" ON public.contact_entities;
DROP POLICY IF EXISTS "Super admins can view all contacts" ON public.contact_entities;
DROP POLICY IF EXISTS "Admins and super admins can view all contacts" ON public.contact_entities;

CREATE POLICY "Admins and super admins can view all contacts"
ON public.contact_entities
FOR SELECT
USING (
  auth.uid() = user_id OR
  has_role('admin'::user_role) OR
  has_role('super_admin'::user_role)
);

-- Create leads policies to allow admin/super admin access
CREATE POLICY "Admins can view all leads"
ON public.leads
FOR SELECT
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "Admins can manage all leads"
ON public.leads
FOR ALL
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role))
WITH CHECK (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- Create lead_documents policies to allow admin/super admin access
CREATE POLICY "Admins can view all documents"
ON public.lead_documents
FOR SELECT
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "Admins can manage all documents"
ON public.lead_documents
FOR ALL
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role))
WITH CHECK (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- Create additional_borrowers admin access
CREATE POLICY "Admins can view all additional borrowers"
ON public.additional_borrowers
FOR SELECT
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- Grant admins access to view all contact encrypted fields (read-only for security)
CREATE POLICY "Admins can view encrypted field metadata"
ON public.contact_encrypted_fields
FOR SELECT
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));