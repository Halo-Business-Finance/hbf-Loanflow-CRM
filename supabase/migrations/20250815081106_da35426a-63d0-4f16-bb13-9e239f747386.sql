-- Add first_name and last_name fields to contact_entities table
ALTER TABLE contact_entities 
ADD COLUMN first_name text,
ADD COLUMN last_name text;