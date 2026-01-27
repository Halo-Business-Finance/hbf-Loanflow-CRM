-- Create document versions table for tracking all document versions
CREATE TABLE IF NOT EXISTS public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_mime_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  change_description TEXT,
  is_current BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  checksum TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT document_versions_document_id_fkey FOREIGN KEY (document_id) 
    REFERENCES public.lead_documents(id) ON DELETE CASCADE,
  CONSTRAINT document_versions_unique_version UNIQUE (document_id, version_number)
);

-- Add version tracking fields to lead_documents
ALTER TABLE public.lead_documents 
  ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_versions INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_version_date TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create index for faster version queries
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON public.document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_current ON public.document_versions(document_id, is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_lead_documents_versions ON public.lead_documents(id, current_version);

-- Enable RLS on document_versions
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_versions
-- Users can view versions for documents they have access to
CREATE POLICY "Users can view document versions they have access to"
  ON public.document_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lead_documents ld
      INNER JOIN public.leads l ON ld.lead_id = l.id
      WHERE ld.id = document_versions.document_id
        AND (
          l.user_id = auth.uid() 
          OR ld.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
              AND ur.role IN ('admin', 'super_admin', 'manager', 'underwriter', 'loan_processor')
              AND ur.is_active = true
          )
        )
    )
  );

-- Users can create versions for their documents
CREATE POLICY "Users can create document versions for their documents"
  ON public.document_versions
  FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM public.lead_documents ld
      INNER JOIN public.leads l ON ld.lead_id = l.id
      WHERE ld.id = document_versions.document_id
        AND (l.user_id = auth.uid() OR ld.user_id = auth.uid())
    )
  );

-- Admins can manage all document versions
CREATE POLICY "Admins can manage all document versions"
  ON public.document_versions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('admin', 'super_admin')
        AND ur.is_active = true
    )
  );

-- Function to create a new document version
CREATE OR REPLACE FUNCTION public.create_document_version(
  p_document_id UUID,
  p_file_path TEXT,
  p_file_size BIGINT,
  p_file_mime_type TEXT,
  p_change_description TEXT DEFAULT NULL,
  p_checksum TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version_id UUID;
  v_next_version INTEGER;
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user has access to the document
  IF NOT EXISTS (
    SELECT 1 FROM lead_documents ld
    INNER JOIN leads l ON ld.lead_id = l.id
    WHERE ld.id = p_document_id
      AND (l.user_id = v_user_id OR ld.user_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'Access denied to document';
  END IF;

  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 
  INTO v_next_version
  FROM document_versions
  WHERE document_id = p_document_id;

  -- Mark all previous versions as not current
  UPDATE document_versions
  SET is_current = false
  WHERE document_id = p_document_id;

  -- Create new version record
  INSERT INTO document_versions (
    document_id,
    version_number,
    file_path,
    file_size,
    file_mime_type,
    uploaded_by,
    change_description,
    is_current,
    checksum
  ) VALUES (
    p_document_id,
    v_next_version,
    p_file_path,
    p_file_size,
    p_file_mime_type,
    v_user_id,
    p_change_description,
    true,
    p_checksum
  )
  RETURNING id INTO v_version_id;

  -- Update lead_documents with new version info
  UPDATE lead_documents
  SET 
    current_version = v_next_version,
    total_versions = v_next_version,
    last_version_date = now(),
    file_path = p_file_path,
    file_size = p_file_size,
    updated_at = now()
  WHERE id = p_document_id;

  RETURN v_version_id;
END;
$$;

-- Function to revert to a previous version
CREATE OR REPLACE FUNCTION public.revert_to_document_version(
  p_document_id UUID,
  p_version_number INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_version_record RECORD;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user has access
  IF NOT EXISTS (
    SELECT 1 FROM lead_documents ld
    INNER JOIN leads l ON ld.lead_id = l.id
    WHERE ld.id = p_document_id
      AND (l.user_id = v_user_id OR ld.user_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'Access denied to document';
  END IF;

  -- Get the version to revert to
  SELECT * INTO v_version_record
  FROM document_versions
  WHERE document_id = p_document_id
    AND version_number = p_version_number;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version not found';
  END IF;

  -- Mark all versions as not current
  UPDATE document_versions
  SET is_current = false
  WHERE document_id = p_document_id;

  -- Mark selected version as current
  UPDATE document_versions
  SET is_current = true
  WHERE document_id = p_document_id
    AND version_number = p_version_number;

  -- Update main document record
  UPDATE lead_documents
  SET 
    file_path = v_version_record.file_path,
    file_size = v_version_record.file_size,
    file_mime_type = v_version_record.file_mime_type,
    current_version = p_version_number,
    updated_at = now()
  WHERE id = p_document_id;

  RETURN true;
END;
$$;

-- Trigger to automatically create initial version when document is created
CREATE OR REPLACE FUNCTION public.create_initial_document_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create initial version record
  INSERT INTO document_versions (
    document_id,
    version_number,
    file_path,
    file_size,
    file_mime_type,
    uploaded_by,
    is_current
  ) VALUES (
    NEW.id,
    1,
    NEW.file_path,
    NEW.file_size,
    NEW.file_mime_type,
    NEW.user_id,
    true
  );

  RETURN NEW;
END;
$$;

-- Create trigger for new documents
DROP TRIGGER IF EXISTS trigger_create_initial_version ON public.lead_documents;
CREATE TRIGGER trigger_create_initial_version
  AFTER INSERT ON public.lead_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.create_initial_document_version();

-- Add comment
COMMENT ON TABLE public.document_versions IS 'Tracks all versions of uploaded documents for audit trail and version control';