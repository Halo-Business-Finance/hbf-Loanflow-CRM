-- Add source column to contact_entities
ALTER TABLE contact_entities 
ADD COLUMN IF NOT EXISTS source TEXT;

-- Add foreign key constraint from leads to contact_entities
ALTER TABLE leads 
ADD CONSTRAINT leads_contact_entity_id_fkey 
FOREIGN KEY (contact_entity_id) 
REFERENCES contact_entities(id) 
ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_leads_contact_entity_id 
ON leads(contact_entity_id);

-- Ensure replica identity is set for realtime updates
ALTER TABLE leads REPLICA IDENTITY FULL;
ALTER TABLE contact_entities REPLICA IDENTITY FULL;

-- Add tables to realtime publication if not already added
DO $$
BEGIN
  -- Check and add leads to publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE leads;
  END IF;

  -- Check and add contact_entities to publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'contact_entities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE contact_entities;
  END IF;
END $$;