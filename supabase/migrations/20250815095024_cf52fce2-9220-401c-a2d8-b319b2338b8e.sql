-- Add separate address fields to contact_entities table
ALTER TABLE public.contact_entities 
ADD COLUMN business_city text,
ADD COLUMN business_state text,
ADD COLUMN business_zip_code text;