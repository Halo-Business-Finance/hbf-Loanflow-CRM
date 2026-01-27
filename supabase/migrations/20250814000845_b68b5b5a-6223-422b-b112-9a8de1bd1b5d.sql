-- Fix critical security vulnerability in lead_documents table (corrected)

-- First, drop all overly permissive policies
DROP POLICY IF EXISTS "All authenticated users can delete lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "All authenticated users can insert lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "All authenticated users can update lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "All authenticated users can view lead documents" ON public.lead_documents;

-- Drop existing policies to recreate them securely
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
  OR
  -- Admins can update any document
  public.get_user_role() IN ('admin', 'super_admin')
)
WITH CHECK (
  -- For regular users: prevent changing ownership or lead association
  (
    user_id = auth.uid()
    AND lead_id IN (
      SELECT id FROM public.leads WHERE user_id = auth.uid()
    )
  )
  OR
  -- Admins can make any changes
  public.get_user_role() IN ('admin', 'super_admin')
);

CREATE POLICY "Secure lead document deletion"
ON public.lead_documents
FOR DELETE
USING (
  -- Users can only delete documents they uploaded for their own leads
  (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leads 
      WHERE leads.id = lead_documents.lead_id 
      AND leads.user_id = auth.uid()
    )
  )
  OR
  -- Admins can delete any document
  public.get_user_role() IN ('admin', 'super_admin')
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
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.security_events (
      user_id, event_type, severity, details
    ) VALUES (
      auth.uid(),
      'document_deleted',
      'high',
      jsonb_build_object(
        'document_id', OLD.id,
        'lead_id', OLD.lead_id,
        'document_name', OLD.document_name,
        'file_path', OLD.file_path,
        'operation', TG_OP,
        'timestamp', now()
      )
    );
    RETURN OLD;
  ELSE
    INSERT INTO public.security_events (
      user_id, event_type, severity, details
    ) VALUES (
      auth.uid(),
      CASE TG_OP
        WHEN 'INSERT' THEN 'document_uploaded'
        WHEN 'UPDATE' THEN 'document_modified'
      END,
      'medium',
      jsonb_build_object(
        'document_id', NEW.id,
        'lead_id', NEW.lead_id,
        'document_name', NEW.document_name,
        'file_path', NEW.file_path,
        'operation', TG_OP,
        'timestamp', now()
      )
    );
    RETURN NEW;
  END IF;
END;
$$;

-- Create audit trigger for document security monitoring
DROP TRIGGER IF EXISTS audit_document_access_trigger ON public.lead_documents;
CREATE TRIGGER audit_document_access_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.lead_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_document_access();