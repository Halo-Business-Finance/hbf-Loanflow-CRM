-- Add priority field to contact_entities table
ALTER TABLE contact_entities 
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_contact_entities_priority ON contact_entities(priority);

-- Add comment for documentation
COMMENT ON COLUMN contact_entities.priority IS 'Application priority level: low, medium, high, or urgent';