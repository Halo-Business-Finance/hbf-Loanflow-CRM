-- Final security cleanup: Remove overly permissive policies (corrected syntax)

-- Remove all universal access policies that expose business data
DROP POLICY IF EXISTS "Users can view approval processes" ON public.approval_processes;
DROP POLICY IF EXISTS "System can read active security headers" ON public.security_headers;
DROP POLICY IF EXISTS "Users can view territories" ON public.territories;
DROP POLICY IF EXISTS "System can manage workflow executions" ON public.workflow_executions;
DROP POLICY IF EXISTS "Users can view workflow executions" ON public.workflow_executions;
DROP POLICY IF EXISTS "Users can view workflows" ON public.workflows;

-- Create secure replacement policies with proper access controls

-- Approval processes: only for users involved in approval process
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='approval_processes' 
      AND policyname='Users can view relevant approval processes'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view relevant approval processes" ON public.approval_processes FOR SELECT USING (auth.uid() = created_by OR has_role(''manager''::user_role) OR has_role(''admin''::user_role) OR has_role(''super_admin''::user_role))';
  END IF;
END $$;

-- Territories: managers and admins only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='territories' 
      AND policyname='Territory access for managers'
  ) THEN
    EXECUTE 'CREATE POLICY "Territory access for managers" ON public.territories FOR SELECT USING (has_role(''manager''::user_role) OR has_role(''admin''::user_role) OR has_role(''super_admin''::user_role))';
  END IF;
END $$;

-- Workflows: owners and admins only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='workflows' 
      AND policyname='Users can view their own workflows'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own workflows" ON public.workflows FOR SELECT USING (auth.uid() = created_by OR has_role(''admin''::user_role) OR has_role(''super_admin''::user_role))';
  END IF;
END $$;

-- Workflow executions: basic admin/owner access (simplified for safety)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='workflow_executions' 
      AND policyname='Admins can view workflow executions'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can view workflow executions" ON public.workflow_executions FOR SELECT USING (has_role(''admin''::user_role) OR has_role(''super_admin''::user_role))';
  END IF;
END $$;