-- Add foreign key constraint from additional_borrowers to leads
ALTER TABLE additional_borrowers 
DROP CONSTRAINT IF EXISTS additional_borrowers_lead_id_fkey;

ALTER TABLE additional_borrowers 
ADD CONSTRAINT additional_borrowers_lead_id_fkey 
FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

-- Add foreign key constraint from additional_borrowers to contact_entities  
ALTER TABLE additional_borrowers 
DROP CONSTRAINT IF EXISTS additional_borrowers_contact_entity_id_fkey;

ALTER TABLE additional_borrowers 
ADD CONSTRAINT additional_borrowers_contact_entity_id_fkey 
FOREIGN KEY (contact_entity_id) REFERENCES contact_entities(id) ON DELETE CASCADE;