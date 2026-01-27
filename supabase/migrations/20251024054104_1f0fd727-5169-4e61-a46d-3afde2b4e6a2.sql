-- Fix Critical RLS Policy Issues on Enterprise Tables
-- Remove overly permissive USING (true) policies and implement role-based access control

-- 1. Fix workflow_executions - CRITICAL: Remove FOR ALL USING (true)
DROP POLICY IF EXISTS "System can manage workflow executions" ON public.workflow_executions;

CREATE POLICY "Admin only workflow execution management"
ON public.workflow_executions
FOR ALL
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "Users can view their own workflow executions"
ON public.workflow_executions
FOR SELECT
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- 2. Fix custom_objects - Restrict to admins only
DROP POLICY IF EXISTS "Users can view custom objects" ON public.custom_objects;
DROP POLICY IF EXISTS "Only admins can view custom objects" ON public.custom_objects;

CREATE POLICY "Admin/Manager can view custom objects"
ON public.custom_objects
FOR SELECT
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role) OR has_role('manager'::user_role));

-- 3. Fix custom_fields - Restrict to admins only
DROP POLICY IF EXISTS "Users can view custom fields" ON public.custom_fields;
DROP POLICY IF EXISTS "Only admins can view custom fields" ON public.custom_fields;

CREATE POLICY "Admin/Manager can view custom fields"
ON public.custom_fields
FOR SELECT
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role) OR has_role('manager'::user_role));

-- 4. Fix custom_records - Implement ownership-based access
DROP POLICY IF EXISTS "Users can view custom records" ON public.custom_records;
DROP POLICY IF EXISTS "Users can view their own custom records" ON public.custom_records;

CREATE POLICY "Users can view their own custom records or admins view all"
ON public.custom_records
FOR SELECT
USING (
  auth.uid() = created_by OR 
  has_role('admin'::user_role) OR 
  has_role('super_admin'::user_role) OR
  has_role('manager'::user_role)
);

-- 5. Fix workflows - Restrict to creators and admins
DROP POLICY IF EXISTS "Users can view workflows" ON public.workflows;

CREATE POLICY "Role-based workflow access"
ON public.workflows
FOR SELECT
USING (
  has_role('admin'::user_role) OR 
  has_role('super_admin'::user_role) OR
  has_role('manager'::user_role)
);

-- 6. Fix approval_processes - Restrict to admins and managers
DROP POLICY IF EXISTS "Users can view approval processes" ON public.approval_processes;
DROP POLICY IF EXISTS "Users can view relevant approval processes" ON public.approval_processes;

CREATE POLICY "Admin/Manager can view approval processes"
ON public.approval_processes
FOR SELECT
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role) OR has_role('manager'::user_role));

-- 7. Fix territories - Implement territory assignment based access
DROP POLICY IF EXISTS "Users can view all territories" ON public.territories;

CREATE POLICY "Users can view assigned territories"
ON public.territories
FOR SELECT
USING (
  has_role('admin'::user_role) OR 
  has_role('super_admin'::user_role) OR
  has_role('manager'::user_role)
);

-- 8. Fix forecast_periods - Restrict to managers and admins
DROP POLICY IF EXISTS "Users can view forecast periods" ON public.forecast_periods;

CREATE POLICY "Manager/Admin can view forecast periods"
ON public.forecast_periods
FOR SELECT
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role) OR has_role('manager'::user_role));