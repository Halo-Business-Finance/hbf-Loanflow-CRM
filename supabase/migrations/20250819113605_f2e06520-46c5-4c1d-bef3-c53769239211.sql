-- Enable real-time functionality for key CRM tables

-- Set REPLICA IDENTITY FULL to capture complete row data during updates
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER TABLE public.contact_entities REPLICA IDENTITY FULL;
ALTER TABLE public.lead_documents REPLICA IDENTITY FULL;
ALTER TABLE public.cases REPLICA IDENTITY FULL;
ALTER TABLE public.opportunities REPLICA IDENTITY FULL;
ALTER TABLE public.additional_borrowers REPLICA IDENTITY FULL;
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;
ALTER TABLE public.security_events REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication to activate real-time functionality
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_entities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.opportunities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.additional_borrowers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_events;