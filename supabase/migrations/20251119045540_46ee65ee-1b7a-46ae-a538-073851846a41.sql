-- Add is_vice_president column to lender_contacts table
ALTER TABLE public.lender_contacts
ADD COLUMN IF NOT EXISTS is_vice_president BOOLEAN NOT NULL DEFAULT false;

-- Create index for better performance when filtering vice presidents
CREATE INDEX IF NOT EXISTS idx_lender_contacts_is_vice_president ON public.lender_contacts(is_vice_president);