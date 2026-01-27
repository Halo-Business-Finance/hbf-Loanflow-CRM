-- Create secure storage policies for lead-documents bucket

-- First ensure the bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('lead-documents', 'lead-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Remove any existing overly permissive storage policies
DELETE FROM storage.policies WHERE bucket_id = 'lead-documents';

-- Create secure storage policies that enforce folder-based access
-- Users can only access files in folders named with their user ID

-- Policy for uploading files
INSERT INTO storage.policies (id, bucket_id, name, definition, check_definition, command)
VALUES (
  gen_random_uuid(),
  'lead-documents',
  'Secure document uploads',
  'bucket_id = ''lead-documents'' AND auth.uid()::text = (storage.foldername(name))[1]',
  'bucket_id = ''lead-documents'' AND auth.uid()::text = (storage.foldername(name))[1]',
  'INSERT'
);

-- Policy for downloading files (users + admins)
INSERT INTO storage.policies (id, bucket_id, name, definition, command)
VALUES (
  gen_random_uuid(),
  'lead-documents',
  'Secure document downloads',
  'bucket_id = ''lead-documents'' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR 
    public.get_user_role() IN (''admin'', ''super_admin'')
  )',
  'SELECT'
);

-- Policy for updating files
INSERT INTO storage.policies (id, bucket_id, name, definition, check_definition, command)
VALUES (
  gen_random_uuid(),
  'lead-documents',
  'Secure document updates',
  'bucket_id = ''lead-documents'' AND auth.uid()::text = (storage.foldername(name))[1]',
  'bucket_id = ''lead-documents'' AND auth.uid()::text = (storage.foldername(name))[1]',
  'UPDATE'
);

-- Policy for deleting files (users + admins)
INSERT INTO storage.policies (id, bucket_id, name, definition, command)
VALUES (
  gen_random_uuid(),
  'lead-documents',
  'Secure document deletion',
  'bucket_id = ''lead-documents'' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR 
    public.get_user_role() IN (''admin'', ''super_admin'')
  )',
  'DELETE'
);