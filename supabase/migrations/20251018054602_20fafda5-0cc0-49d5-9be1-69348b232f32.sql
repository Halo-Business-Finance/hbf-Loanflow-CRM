-- Remove admin role-based storage policies to fix recursion
DROP POLICY IF EXISTS "Admins can access all documents" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can access all documents" ON storage.objects;