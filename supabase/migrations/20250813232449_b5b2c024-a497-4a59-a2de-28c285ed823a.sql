-- Final security cleanup: Remove all overly permissive policies
-- Remove policies with "qual:true" that allow universal access

-- 1) Fix approval_processes - remove universal SELECT policy
DROP POLICY IF EXISTS "Users can view approval processes" ON public.approval_processes;

-- 2) Fix security_headers - remove universal READ policy  
DROP POLICY IF EXISTS "System can read active security headers" ON public.security_headers;

-- 3) Fix territories - remove universal SELECT policy
DROP POLICY IF EXISTS "Users can view territories" ON public.territories;

-- 4) Fix workflow_executions - remove universal policies
DROP POLICY IF EXISTS "System can manage workflow executions" ON public.workflow_executions;
DROP POLICY IF EXISTS "Users can view workflow executions" ON public.workflow_executions;

-- 5) Fix workflows - remove universal SELECT policy
DROP POLICY IF EXISTS "Users can view workflows" ON public.workflows;

-- Now ensure proper restricted policies exist for legitimate access:

-- Approval processes: only for users involved in approval process
CREATE POLICY IF NOT EXISTS "Users can view relevant approval processes"
ON public.approval_processes
FOR SELECT
USING (
  auth.uid() = created_by OR 
  has_role('manager'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('super_admin'::user_role)
);

-- Territories: managers and admins only
CREATE POLICY IF NOT EXISTS "Territory access for managers"
ON public.territories  
FOR SELECT
USING (
  has_role('manager'::user_role) OR 
  has_role('admin'::user_role) OR 
  has_role('super_admin'::user_role)
);

-- Workflows: owners and admins only
CREATE POLICY IF NOT EXISTS "Users can view their own workflows"
ON public.workflows
FOR SELECT  
USING (
  auth.uid() = created_by OR 
  has_role('admin'::user_role) OR 
  has_role('super_admin'::user_role)
);

-- Workflow executions: restrict to workflow owners and admins
CREATE POLICY IF NOT EXISTS "Users can view their workflow executions"
ON public.workflow_executions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workflows 
    WHERE workflows.id = workflow_executions.workflow_id 
    AND (workflows.created_by = auth.uid() OR has_role('admin'::user_role))
  ) OR 
  has_role('admin'::user_role) OR 
  has_role('super_admin'::user_role)
);

-- Log the final security cleanup
INSERT INTO public.audit_logs (
  action, table_name, new_values
) VALUES (
  'final_security_cleanup_business_data', 
  'multiple_business_tables',
  jsonb_build_object(
    'description', 'Removed all overly permissive RLS policies and implemented proper access controls',
    'tables_secured', ARRAY['approval_processes', 'security_headers', 'territories', 'workflows', 'workflow_executions'],
    'policies_removed', ARRAY['Users can view approval processes', 'System can read active security headers', 'Users can view territories', 'System can manage workflow executions', 'Users can view workflow executions', 'Users can view workflows'],
    'fix_applied_at', now(),
    'security_level', 'critical',
    'impact', 'Eliminated business data exposure and security config leaks'
  )
);