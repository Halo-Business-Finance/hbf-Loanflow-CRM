-- Fix critical security vulnerability in lead_documents table

-- First, drop all overly permissive policies
DROP POLICY IF EXISTS "All authenticated users can delete lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "All authenticated users can insert lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "All authenticated users can update lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "All authenticated users can view lead documents" ON public.lead_documents;

-- Keep the more secure policies but ensure they're properly scoped
DROP POLICY IF EXISTS "Users can create lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Users can manage their lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Users can only access their own lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Users can view their lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Admins can manage all lead documents" ON public.lead_documents;

-- Create secure ownership-based policies for lead documents
CREATE POLICY "Secure lead document viewing"
ON public.lead_documents
FOR SELECT
USING (
  -- Users can view documents for leads they own
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = lead_documents.lead_id 
    AND leads.user_id = auth.uid()
  )
  OR 
  -- Users can view documents they uploaded
  user_id = auth.uid()
  OR
  -- Admins can view all documents  
  public.get_user_role() IN ('admin', 'super_admin')
);

CREATE POLICY "Secure lead document creation"
ON public.lead_documents
FOR INSERT
WITH CHECK (
  -- Users can only upload documents for leads they own
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = lead_documents.lead_id 
    AND leads.user_id = auth.uid()
  )
  AND
  -- Must set user_id to themselves
  user_id = auth.uid()
);

CREATE POLICY "Secure lead document updates"
ON public.lead_documents
FOR UPDATE
USING (
  -- Users can only update documents they uploaded for their own leads
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = lead_documents.lead_id 
    AND leads.user_id = auth.uid()
  )
)
WITH CHECK (
  -- Prevent changing ownership or lead association
  user_id = OLD.user_id
  AND lead_id = OLD.lead_id
);

CREATE POLICY "Secure lead document deletion"
ON public.lead_documents
FOR DELETE
USING (
  -- Users can only delete documents they uploaded for their own leads
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = lead_documents.lead_id 
    AND leads.user_id = auth.uid()
  )
  OR
  -- Admins can delete any document
  public.get_user_role() IN ('admin', 'super_admin')
);

-- Create secure storage policies for lead-documents bucket
-- Drop existing storage policies that might be too permissive
DELETE FROM storage.policies WHERE bucket_id = 'lead-documents';

-- Secure storage policies for the lead-documents bucket
INSERT INTO storage.policies (bucket_id, name, definition, check_definition)
VALUES 
  (
    'lead-documents',
    'Secure lead document uploads',
    'bucket_id = ''lead-documents'' AND auth.uid()::text = (storage.foldername(name))[1]',
    'bucket_id = ''lead-documents'' AND auth.uid()::text = (storage.foldername(name))[1]'
  ),
  (
    'lead-documents',
    'Secure lead document downloads',  
    'bucket_id = ''lead-documents'' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.get_user_role() IN (''admin'', ''super_admin''))',
    NULL
  ),
  (
    'lead-documents',
    'Secure lead document deletion',
    'bucket_id = ''lead-documents'' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.get_user_role() IN (''admin'', ''super_admin''))',
    NULL
  );

-- Function to securely validate document access
CREATE OR REPLACE FUNCTION public.validate_document_access(
  p_document_id uuid,
  p_action text DEFAULT 'read'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  doc_record RECORD;
  user_role text;
BEGIN
  -- Get document details
  SELECT ld.*, l.user_id as lead_owner_id
  INTO doc_record
  FROM public.lead_documents ld
  JOIN public.leads l ON l.id = ld.lead_id
  WHERE ld.id = p_document_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Get user role
  user_role := public.get_user_role()::text;
  
  -- Check access based on action
  CASE p_action
    WHEN 'read' THEN
      RETURN (
        -- Document uploader
        doc_record.user_id = auth.uid() OR
        -- Lead owner
        doc_record.lead_owner_id = auth.uid() OR
        -- Admin
        user_role IN ('admin', 'super_admin')
      );
    WHEN 'write', 'delete' THEN
      RETURN (
        -- Only document uploader for their own leads
        (doc_record.user_id = auth.uid() AND doc_record.lead_owner_id = auth.uid()) OR
        -- Admin
        user_role IN ('admin', 'super_admin')
      );
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Function to audit document access attempts
CREATE OR REPLACE FUNCTION public.audit_document_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log document access for security monitoring
  INSERT INTO public.security_events (
    user_id, event_type, severity, details
  ) VALUES (
    auth.uid(),
    CASE TG_OP
      WHEN 'INSERT' THEN 'document_uploaded'
      WHEN 'UPDATE' THEN 'document_modified'
      WHEN 'DELETE' THEN 'document_deleted'
    END,
    CASE TG_OP
      WHEN 'DELETE' THEN 'high'
      ELSE 'medium'
    END,
    jsonb_build_object(
      'document_id', COALESCE(NEW.id, OLD.id),
      'lead_id', COALESCE(NEW.lead_id, OLD.lead_id),
      'document_name', COALESCE(NEW.document_name, OLD.document_name),
      'file_path', COALESCE(NEW.file_path, OLD.file_path),
      'operation', TG_OP,
      'timestamp', now()
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create audit trigger for document security monitoring
DROP TRIGGER IF EXISTS audit_document_access_trigger ON public.lead_documents;
CREATE TRIGGER audit_document_access_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.lead_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_document_access();