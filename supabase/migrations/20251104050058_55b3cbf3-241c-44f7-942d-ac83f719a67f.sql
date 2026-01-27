-- Enable realtime for pipeline-related tables
-- Ensure publication exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Set REPLICA IDENTITY FULL for complete row data on updates/deletes
ALTER TABLE IF EXISTS public.leads REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.contact_entities REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.pipeline_entries REPLICA IDENTITY FULL;

-- Add tables to publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contact_entities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_entities;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pipeline_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_entries;
  END IF;
END $$;