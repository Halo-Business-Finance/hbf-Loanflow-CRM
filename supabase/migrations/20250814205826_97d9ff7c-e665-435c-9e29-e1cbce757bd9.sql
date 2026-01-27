-- Fix potential issues with the contact_encrypted_fields foreign key constraint
-- First drop and recreate the constraint to ensure it's working properly

ALTER TABLE contact_encrypted_fields DROP CONSTRAINT IF EXISTS contact_encrypted_fields_contact_id_fkey;

-- Recreate the foreign key constraint with proper settings
ALTER TABLE contact_encrypted_fields 
ADD CONSTRAINT contact_encrypted_fields_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES contact_entities(id) 
ON DELETE CASCADE ON UPDATE CASCADE;

-- Also ensure we have a proper unique constraint for the composite key
DROP INDEX IF EXISTS contact_encrypted_fields_contact_id_field_name_idx;
CREATE UNIQUE INDEX contact_encrypted_fields_contact_id_field_name_idx 
ON contact_encrypted_fields(contact_id, field_name);