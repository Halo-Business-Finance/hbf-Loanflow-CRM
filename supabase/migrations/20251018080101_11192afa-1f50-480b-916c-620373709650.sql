-- Create storage bucket for document templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('document-templates', 'document-templates', true);

-- Create document_templates table
CREATE TABLE public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL, -- 'loan_application', 'income_verification', etc.
  file_path TEXT NOT NULL,
  file_format TEXT NOT NULL, -- 'pdf', 'docx', 'xlsx', etc.
  file_size INTEGER,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_templates
-- Everyone can view active templates
CREATE POLICY "Anyone can view active templates"
ON public.document_templates
FOR SELECT
USING (is_active = true);

-- Only admins and super_admins can insert templates
CREATE POLICY "Admins can create templates"
ON public.document_templates
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role(auth.uid()) IN ('admin', 'super_admin')
);

-- Only admins and super_admins can update templates
CREATE POLICY "Admins can update templates"
ON public.document_templates
FOR UPDATE
TO authenticated
USING (
  public.get_user_role(auth.uid()) IN ('admin', 'super_admin')
)
WITH CHECK (
  public.get_user_role(auth.uid()) IN ('admin', 'super_admin')
);

-- Only super_admins can delete templates
CREATE POLICY "Super admins can delete templates"
ON public.document_templates
FOR DELETE
TO authenticated
USING (public.get_user_role(auth.uid()) = 'super_admin');

-- Storage policies for document-templates bucket
-- Allow authenticated users to view templates
CREATE POLICY "Anyone can view document templates"
ON storage.objects
FOR SELECT
USING (bucket_id = 'document-templates');

-- Only admins and super_admins can upload templates
CREATE POLICY "Admins can upload document templates"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'document-templates' AND
  public.get_user_role(auth.uid()) IN ('admin', 'super_admin')
);

-- Only admins and super_admins can update templates
CREATE POLICY "Admins can update document templates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'document-templates' AND
  public.get_user_role(auth.uid()) IN ('admin', 'super_admin')
);

-- Only super_admins can delete templates from storage
CREATE POLICY "Super admins can delete document templates"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'document-templates' AND
  public.get_user_role(auth.uid()) = 'super_admin'
);

-- Create index for better query performance
CREATE INDEX idx_document_templates_type ON public.document_templates(template_type);
CREATE INDEX idx_document_templates_active ON public.document_templates(is_active);

-- Function to increment usage count
CREATE OR REPLACE FUNCTION public.increment_template_usage(template_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.document_templates
  SET usage_count = usage_count + 1,
      updated_at = now()
  WHERE id = template_id;
END;
$$;