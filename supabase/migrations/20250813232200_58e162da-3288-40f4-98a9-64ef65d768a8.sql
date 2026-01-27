-- Comprehensive security fix for all 5 identified vulnerabilities (corrected)
-- Fix business data exposure and security configuration leaks

-- 1) CRITICAL: Secure security_headers table (highest priority)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_headers') THEN
    ALTER TABLE public.security_headers ENABLE ROW LEVEL SECURITY;
    
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='security_headers' 
        AND policyname='All users can view security headers'
    ) THEN
      EXECUTE 'DROP POLICY "All users can view security headers" ON public.security_headers';
    END IF;
    
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
    ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
    
    -- Drop specific known permissive policies
    EXECUTE 'DROP POLICY IF EXISTS "All users can view workflows" ON public.workflows';
    EXECUTE 'DROP POLICY IF EXISTS "Public can view workflows" ON public.workflows';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view workflows" ON public.workflows';
    
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
    ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
    
    -- Drop known permissive policies
    EXECUTE 'DROP POLICY IF EXISTS "All users can view workflow executions" ON public.workflow_executions';
    EXECUTE 'DROP POLICY IF EXISTS "Public access to workflow executions" ON public.workflow_executions';
    
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
    ALTER TABLE public.approval_processes ENABLE ROW LEVEL SECURITY;
    
    -- The existing policy is already secure, but ensure no public policies exist
    EXECUTE 'DROP POLICY IF EXISTS "All users can view approval processes" ON public.approval_processes';
    EXECUTE 'DROP POLICY IF EXISTS "Public can view approval processes" ON public.approval_processes';
    
    -- Ensure admin policy exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='approval_processes' 
        AND policyname='Admins can manage approval processes'
    ) THEN
      EXECUTE 'CREATE POLICY "Admins can manage approval processes" ON public.approval_processes FOR ALL USING (has_role(''admin''::user_role) OR has_role(''super_admin''::user_role))';
    END IF;
  END IF;
END $$;

-- 5) Secure territories table - protect sales territory strategy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'territories') THEN
    ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;
    
    -- Drop any public access policies
    EXECUTE 'DROP POLICY IF EXISTS "All users can view territories" ON public.territories';
    EXECUTE 'DROP POLICY IF EXISTS "Public can view territories" ON public.territories';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view all territories" ON public.territories';
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='territories' 
        AND policyname='Territory access by role'
    ) THEN
      EXECUTE 'CREATE POLICY "Territory access by role" ON public.territories FOR SELECT USING (has_role(''admin''::user_role) OR has_role(''manager''::user_role) OR has_role(''super_admin''::user_role))';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='territories' 
        AND policyname='Territory managers can manage territories'
    ) THEN
      EXECUTE 'CREATE POLICY "Territory managers can manage territories" ON public.territories FOR ALL USING (auth.uid() = manager_id OR has_role(''admin''::user_role))';
    END IF;
  END IF;
END $$;