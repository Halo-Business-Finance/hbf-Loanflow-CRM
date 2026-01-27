-- Check if there's a foreign key constraint causing issues and remove it if needed
-- First, let's see what foreign key constraints exist on contact_encrypted_fields
DO $$
BEGIN
  -- Remove any problematic foreign key constraints
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'contact_encrypted_fields_contact_id_fkey' 
    AND table_name = 'contact_encrypted_fields'
  ) THEN
    ALTER TABLE contact_encrypted_fields DROP CONSTRAINT contact_encrypted_fields_contact_id_fkey;
  END IF;
  
  -- Add a proper foreign key constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'contact_encrypted_fields_contact_id_fkey' 
    AND table_name = 'contact_encrypted_fields'
  ) THEN
    ALTER TABLE contact_encrypted_fields 
    ADD CONSTRAINT contact_encrypted_fields_contact_id_fkey 
    FOREIGN KEY (contact_id) REFERENCES contact_entities(id) ON DELETE CASCADE;
  END IF;
END $$;