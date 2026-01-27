-- Fix critical security vulnerabilities in sensitive data tables (corrected)

-- Fix the dangerous pipeline_entries policy
DROP POLICY IF EXISTS "All authenticated users can create pipeline entries" ON public.pipeline_entries;

-- Create secure pipeline entries policy
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

-- Create more restrictive loan request policies based on actual table structure
CREATE POLICY "Restricted loan request access" 
ON public.loan_requests 
FOR SELECT 
USING (
  -- Users can see their own requests
  auth.uid() = user_id 
  -- Admins can see all
  OR has_role('admin'::user_role) 
  OR has_role('super_admin'::user_role)
  -- Managers can see all 
  OR has_role('manager'::user_role)
  -- Loan processors can only see requests in active processing
  OR (
    has_role('loan_processor'::user_role) 
    AND status IN ('pending', 'under_review', 'processing')
  )
);

CREATE POLICY "Restricted loan request updates" 
ON public.loan_requests 
FOR UPDATE 
USING (
  -- Users can update their own requests (if not yet approved)
  (auth.uid() = user_id AND status NOT IN ('approved', 'funded', 'closed'))
  -- Authorized staff can update any request
  OR has_role('admin'::user_role) 
  OR has_role('super_admin'::user_role)
  OR has_role('manager'::user_role)
  OR has_role('loan_processor'::user_role)
)
WITH CHECK (
  -- Same restrictions for WITH CHECK
  (auth.uid() = user_id AND status NOT IN ('approved', 'funded', 'closed'))
  OR has_role('admin'::user_role) 
  OR has_role('super_admin'::user_role)
  OR has_role('manager'::user_role)
  OR has_role('loan_processor'::user_role)
);

-- Add missing INSERT policy for loan_requests
CREATE POLICY "Users can create loan requests for themselves" 
ON public.loan_requests 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND auth.uid() IS NOT NULL
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
      'missing_access_controls'
    ],
    'impact', 'prevented_unauthorized_data_access_and_manipulation'
  )
);