-- Add is_closer column to lender_contacts table
ALTER TABLE public.lender_contacts
ADD COLUMN IF NOT EXISTS is_closer BOOLEAN NOT NULL DEFAULT false;

-- Create index for better performance when filtering closers
CREATE INDEX IF NOT EXISTS idx_lender_contacts_is_closer ON public.lender_contacts(is_closer);