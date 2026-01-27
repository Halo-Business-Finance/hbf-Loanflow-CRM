-- Create lead-documents storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lead-documents',
  'lead-documents',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for lead-documents bucket
-- Users can upload documents to their own folder
CREATE POLICY "Users can upload documents to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lead-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can view their own documents
CREATE POLICY "Users can view their own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'lead-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own documents
CREATE POLICY "Users can update their own documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lead-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'lead-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can access all documents
CREATE POLICY "Admins can access all documents"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'lead-documents' AND
  has_role('admin'::user_role)
);

-- Super admins can access all documents
CREATE POLICY "Super admins can access all documents"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'lead-documents' AND
  has_role('super_admin'::user_role)
);