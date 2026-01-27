-- Add logo field to lenders table
ALTER TABLE lenders ADD COLUMN IF NOT EXISTS logo_url text;