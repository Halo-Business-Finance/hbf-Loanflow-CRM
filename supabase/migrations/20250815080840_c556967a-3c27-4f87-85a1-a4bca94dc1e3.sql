-- Add personal email field to contact_entities table
ALTER TABLE contact_entities 
ADD COLUMN personal_email text;