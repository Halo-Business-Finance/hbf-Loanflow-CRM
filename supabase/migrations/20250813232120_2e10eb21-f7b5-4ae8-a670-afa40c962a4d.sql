-- Comprehensive security fix for all 5 identified vulnerabilities
-- Fix business data exposure and security configuration leaks

-- 1) CRITICAL: Secure security_headers table (highest priority)
-- Currently publicly readable, exposing security config to attackers
DO $$
BEGIN
  -- Check if table exists first
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_headers') THEN
    -- Enable RLS if not already enabled
    EXECUTE 'ALTER TABLE public.security_headers ENABLE ROW LEVEL SECURITY';
    
    -- Drop any existing permissive policies
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='security_headers' 
        AND policyname='All users can view security headers'
    ) THEN
      EXECUTE 'DROP POLICY "All users can view security headers" ON public.security_headers';
    END IF;
    
    -- Create admin-only access policy
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='security_headers' 
        AND policyname='Admins can manage security headers'
    ) THEN
      EXECUTE 'CREATE POLICY "Admins can manage security headers" ON public.security_headers FOR ALL USING (has_role(''admin''::user_role) OR has_role(''super_admin''::user_role))';
    END IF;
  END IF;
END $$;

-- 2) Secure workflows table - protect business automation logic
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflows') THEN
    EXECUTE 'ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY';
    
    -- Remove any overly permissive policies
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='workflows' 
        AND policyname LIKE '%can view%workflows%' AND policyname NOT LIKE '%own%'
    ) THEN
      FOR policy_rec IN (
        SELECT policyname FROM pg_policies 
        WHERE schemaname='public' AND tablename='workflows' 
          AND policyname LIKE '%can view%workflows%' AND policyname NOT LIKE '%own%'
      ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.workflows', policy_rec.policyname);
      END LOOP;
    END IF;
    
    -- Create secure policies
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='workflows' 
        AND policyname='Users can manage their own workflows'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can manage their own workflows" ON public.workflows FOR ALL USING (auth.uid() = created_by OR has_role(''admin''::user_role))';
    END IF;
  END IF;
END $$;

-- 3) Secure workflow_executions table - protect business process data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_executions') THEN
    EXECUTE 'ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY';
    
    -- Remove permissive policies
    FOR policy_rec IN (
      SELECT policyname FROM pg_policies 
      WHERE schemaname='public' AND tablename='workflow_executions'
        AND (policyname LIKE '%public%' OR policyname LIKE '%all users%')
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.workflow_executions', policy_rec.policyname);
    END LOOP;
    
    -- Create execution access policy
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='workflow_executions' 
        AND policyname='Users can view their workflow executions'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can view their workflow executions" ON public.workflow_executions FOR SELECT USING (auth.uid() = executed_by OR has_role(''admin''::user_role))';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='workflow_executions' 
        AND policyname='Users can create workflow executions'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can create workflow executions" ON public.workflow_executions FOR INSERT WITH CHECK (auth.uid() = executed_by)';
    END IF;
  END IF;
END $$;

-- 4) Secure approval_processes table - protect internal approval workflows
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'approval_processes') THEN
    EXECUTE 'ALTER TABLE public.approval_processes ENABLE ROW LEVEL SECURITY';
    
    -- Check if there's already a good policy
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='approval_processes' 
        AND policyname='Admins can manage approval processes'
    ) THEN
      -- Remove any overly permissive policies first
      FOR policy_rec IN (
        SELECT policyname FROM pg_policies 
        WHERE schemaname='public' AND tablename='approval_processes'
          AND policyname LIKE '%can view%' AND policyname NOT LIKE '%admin%'
      ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.approval_processes', policy_rec.policyname);
      END LOOP;
      
      -- Create admin-managed policy (approval processes are typically admin-controlled)
      EXECUTE 'CREATE POLICY "Admins can manage approval processes" ON public.approval_processes FOR ALL USING (has_role(''admin''::user_role) OR has_role(''super_admin''::user_role))';
    END IF;
    
    -- Users can view processes they're involved in
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='approval_processes' 
        AND policyname='Users can view relevant approval processes'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can view relevant approval processes" ON public.approval_processes FOR SELECT USING (auth.uid() = created_by OR has_role(''manager''::user_role) OR has_role(''admin''::user_role))';
    END IF;
  END IF;
END $$;

-- 5) Secure territories table - protect sales territory strategy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'territories') THEN
    EXECUTE 'ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY';
    
    -- Remove any public access policies
    FOR policy_rec IN (
      SELECT policyname FROM pg_policies 
      WHERE schemaname='public' AND tablename='territories'
        AND (policyname LIKE '%public%' OR policyname LIKE '%all%can%view%')
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.territories', policy_rec.policyname);
    END LOOP;
    
    -- Create role-based access
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='territories' 
        AND policyname='Territory access by role'
    ) THEN
      EXECUTE 'CREATE POLICY "Territory access by role" ON public.territories FOR SELECT USING (has_role(''admin''::user_role) OR has_role(''manager''::user_role) OR has_role(''super_admin''::user_role))';
    END IF;
    
    -- Allow territory managers to manage their territories
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='territories' 
        AND policyname='Territory managers can manage territories'
    ) THEN
      EXECUTE 'CREATE POLICY "Territory managers can manage territories" ON public.territories FOR ALL USING (auth.uid() = manager_id OR has_role(''admin''::user_role))';
    END IF;
  END IF;
END $$;

-- Log all security fixes applied
INSERT INTO public.audit_logs (
  action, table_name, new_values
) VALUES (
  'comprehensive_security_fix_business_data', 
  'multiple_tables',
  jsonb_build_object(
    'description', 'Applied comprehensive RLS fixes to 5 tables with business data exposure',
    'tables_secured', ARRAY['security_headers', 'workflows', 'workflow_executions', 'approval_processes', 'territories'],
    'fix_applied_at', now(),
    'security_level', 'critical',
    'impact', 'Prevented business logic theft and security config exposure'
  )
);