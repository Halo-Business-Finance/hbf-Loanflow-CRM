-- Enable RLS policies for contact_entities table
-- This allows users to view their own contact entities and managers/admins to view all

-- Policy for regular users to view their own contact entities
CREATE POLICY "Users can view their own contact entities"
ON contact_entities
FOR SELECT
USING (auth.uid() = user_id);

-- Policy for managers and admins to view all contact entities
CREATE POLICY "Managers and admins can view all contact entities"
ON contact_entities
FOR SELECT
USING (
  has_role('manager'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('super_admin'::user_role)
);

-- Policy for users to insert their own contact entities
CREATE POLICY "Users can insert their own contact entities"
ON contact_entities
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own contact entities
CREATE POLICY "Users can update their own contact entities"
ON contact_entities
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy for managers and admins to update all contact entities
CREATE POLICY "Managers and admins can update all contact entities"
ON contact_entities
FOR UPDATE
USING (
  has_role('manager'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('super_admin'::user_role)
);

-- Policy for users to delete their own contact entities
CREATE POLICY "Users can delete their own contact entities"
ON contact_entities
FOR DELETE
USING (auth.uid() = user_id);

-- Policy for managers and admins to delete all contact entities
CREATE POLICY "Managers and admins can delete all contact entities"
ON contact_entities
FOR DELETE
USING (
  has_role('manager'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('super_admin'::user_role)
);