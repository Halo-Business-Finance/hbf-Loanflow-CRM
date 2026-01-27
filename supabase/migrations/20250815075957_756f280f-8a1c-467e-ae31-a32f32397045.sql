-- Add ownership percentage field to contact_entities table
ALTER TABLE contact_entities 
ADD COLUMN ownership_percentage numeric(5,2) CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100);