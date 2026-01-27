-- Add lead_number column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_number SERIAL;

-- Create a sequence starting from 003
CREATE SEQUENCE IF NOT EXISTS leads_number_seq START WITH 3;

-- Update the lead_number column to use the sequence
ALTER TABLE leads ALTER COLUMN lead_number SET DEFAULT nextval('leads_number_seq');

-- Update existing leads with sequential numbers starting from 003
WITH numbered_leads AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) + 2 as new_number
  FROM leads
)
UPDATE leads 
SET lead_number = numbered_leads.new_number
FROM numbered_leads
WHERE leads.id = numbered_leads.id;

-- Set the sequence to continue from the highest existing number
SELECT setval('leads_number_seq', COALESCE((SELECT MAX(lead_number) FROM leads), 2) + 1, false);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_lead_number ON leads(lead_number);