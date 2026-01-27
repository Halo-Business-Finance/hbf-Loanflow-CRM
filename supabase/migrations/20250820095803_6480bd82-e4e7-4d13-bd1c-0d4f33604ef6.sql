-- Enable real-time updates for leads table
ALTER TABLE public.leads REPLICA IDENTITY FULL;

-- Add leads table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;

-- Also enable real-time for contact_entities since leads depend on them
ALTER TABLE public.contact_entities REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_entities;