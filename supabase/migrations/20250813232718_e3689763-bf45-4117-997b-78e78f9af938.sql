-- Final security fix for remaining critical vulnerabilities
-- Fix lead_documents and blockchain_records table access

-- 1) CRITICAL: Secure lead_documents table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_documents') THEN
    ALTER TABLE public.lead_documents ENABLE ROW LEVEL SECURITY;
    
    -- Drop any overly permissive policies
    EXECUTE 'DROP POLICY IF EXISTS "All users can manage lead documents" ON public.lead_documents';
    EXECUTE 'DROP POLICY IF EXISTS "Public can access lead documents" ON public.lead_documents';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can manage lead documents" ON public.lead_documents';
    
    -- Create secure policies for lead documents
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='lead_documents' 
        AND policyname='Users can view their lead documents'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can view their lead documents" ON public.lead_documents FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_documents.lead_id AND leads.user_id = auth.uid()))';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='lead_documents' 
        AND policyname='Users can manage their lead documents'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can manage their lead documents" ON public.lead_documents FOR ALL USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_documents.lead_id AND leads.user_id = auth.uid()))';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='lead_documents' 
        AND policyname='Admins can manage all lead documents'
    ) THEN
      EXECUTE 'CREATE POLICY "Admins can manage all lead documents" ON public.lead_documents FOR ALL USING (has_role(''admin''::user_role) OR has_role(''super_admin''::user_role))';
    END IF;
  END IF;
END $$;

-- 2) Secure blockchain_records table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'blockchain_records') THEN
    -- Drop the overly permissive policy
    EXECUTE 'DROP POLICY IF EXISTS "Users can view relevant blockchain records" ON public.blockchain_records';
    EXECUTE 'DROP POLICY IF EXISTS "Public can view blockchain records" ON public.blockchain_records';
    
    -- The "Only admins can view verified blockchain records" policy already exists and is good
    -- But we need to ensure users can only see records related to their own data
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='blockchain_records' 
        AND policyname='Users can view blockchain records for their data'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can view blockchain records for their data" ON public.blockchain_records FOR SELECT USING (
        -- Users can view blockchain records for their own leads/clients
        EXISTS (
          SELECT 1 FROM public.leads 
          WHERE leads.id::text = blockchain_records.record_id 
          AND leads.user_id = auth.uid()
        ) OR 
        EXISTS (
          SELECT 1 FROM public.clients 
          WHERE clients.id::text = blockchain_records.record_id 
          AND clients.user_id = auth.uid()
        ) OR
        -- Or if they are admin
        has_role(''admin''::user_role) OR has_role(''super_admin''::user_role)
      )';
    END IF;
  END IF;
END $$;

-- Log final security hardening completion
INSERT INTO public.audit_logs (
  action, table_name, new_values
) VALUES (
  'final_security_vulnerabilities_resolved', 
  'lead_documents_blockchain_records',
  jsonb_build_object(
    'description', 'Resolved final critical security vulnerabilities in document and blockchain systems',
    'tables_secured', ARRAY['lead_documents', 'blockchain_records'],
    'critical_issues_resolved', 2,
    'fix_applied_at', now(),
    'security_level', 'critical',
    'impact', 'All sensitive documents and blockchain records now properly secured',
    'total_security_fixes', 6
  )
);