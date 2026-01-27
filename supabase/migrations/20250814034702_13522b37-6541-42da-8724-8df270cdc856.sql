-- Fix critical security vulnerabilities in sensitive data tables

-- Fix the dangerous pipeline_entries policy
DROP POLICY IF EXISTS "All authenticated users can create pipeline entries" ON public.pipeline_entries;

-- Create secure pipeline entries policies
CREATE POLICY "Users can create pipeline entries for their own leads" 
ON public.pipeline_entries 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND (
    -- Either the lead belongs to the user
    EXISTS (
      SELECT 1 FROM public.leads 
      WHERE leads.id = pipeline_entries.lead_id 
      AND leads.user_id = auth.uid()
    )
    -- Or user is admin/manager
    OR has_role('admin'::user_role) 
    OR has_role('super_admin'::user_role)
    OR has_role('manager'::user_role)
  )
);

-- Enhance loan_requests security by restricting overly broad access
DROP POLICY IF EXISTS "Loan professionals can access requests for processing" ON public.loan_requests;
DROP POLICY IF EXISTS "Loan professionals can update request status" ON public.loan_requests;

-- Create more restrictive loan request policies
CREATE POLICY "Loan processors can access assigned requests only" 
ON public.loan_requests 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (
    has_role('loan_processor'::user_role) 
    AND assigned_processor_id = auth.uid()
  )
  OR has_role('admin'::user_role) 
  OR has_role('super_admin'::user_role)
);

CREATE POLICY "Only authorized users can update loan requests" 
ON public.loan_requests 
FOR UPDATE 
USING (
  auth.uid() = user_id 
  OR (
    has_role('loan_processor'::user_role) 
    AND assigned_processor_id = auth.uid()
  )
  OR has_role('admin'::user_role) 
  OR has_role('super_admin'::user_role)
)
WITH CHECK (
  auth.uid() = user_id 
  OR (
    has_role('loan_processor'::user_role) 
    AND assigned_processor_id = auth.uid()
  )
  OR has_role('admin'::user_role) 
  OR has_role('super_admin'::user_role)
);

-- Add missing DELETE policy for loan_requests
CREATE POLICY "Only owners and admins can delete loan requests" 
ON public.loan_requests 
FOR DELETE 
USING (
  auth.uid() = user_id 
  OR has_role('admin'::user_role) 
  OR has_role('super_admin'::user_role)
);

-- Ensure profiles table has proper INSERT restrictions
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can only create their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  auth.uid() = id 
  AND auth.uid() IS NOT NULL
);

-- Log the security enhancement
INSERT INTO public.security_events (
  event_type, severity, details
) VALUES (
  'critical_security_vulnerabilities_fixed',
  'high',
  jsonb_build_object(
    'tables_secured', ARRAY['pipeline_entries', 'loan_requests', 'profiles'],
    'vulnerabilities_fixed', ARRAY[
      'unrestricted_pipeline_entry_creation',
      'overly_broad_loan_processor_access', 
      'missing_loan_deletion_controls'
    ],
    'impact', 'prevented_unauthorized_data_access_and_manipulation'
  )
);