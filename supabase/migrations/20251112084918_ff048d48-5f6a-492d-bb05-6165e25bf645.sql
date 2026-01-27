-- Make user_id nullable in leads table to allow unassigned leads
ALTER TABLE leads ALTER COLUMN user_id DROP NOT NULL;