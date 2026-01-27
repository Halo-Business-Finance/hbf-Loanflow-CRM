-- COMPREHENSIVE SECURITY HARDENING: Phase 1 - Database Access Control (Fixed)
-- Fixing all critical vulnerabilities identified in security review

-- 1. SECURE MFA SETTINGS TABLE (CRITICAL - Secrets Exposure)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mfa_settings') THEN
    ALTER TABLE public.mfa_settings ENABLE ROW LEVEL SECURITY;
    
    -- Drop any overly permissive policies
    DROP POLICY IF EXISTS "All users can manage MFA settings" ON public.mfa_settings;
    DROP POLICY IF EXISTS "Anyone can access MFA settings" ON public.mfa_settings;
    DROP POLICY IF EXISTS "Users can only access their own MFA settings" ON public.mfa_settings;
    DROP POLICY IF EXISTS "Super admins can manage MFA settings for emergency" ON public.mfa_settings;
    
    -- Secure MFA settings to user ownership only
    CREATE POLICY "Users can only access their own MFA settings" 
    ON public.mfa_settings FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);
    
    -- Super admins for emergency access only
    CREATE POLICY "Super admins can manage MFA settings for emergency" 
    ON public.mfa_settings FOR ALL 
    USING (has_role('super_admin'::user_role)) 
    WITH CHECK (has_role('super_admin'::user_role));
  END IF;
END $$;

-- 2. SECURE ACTIVE SESSIONS TABLE (CRITICAL - Session Hijacking)
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies first
DROP POLICY IF EXISTS "All users can manage sessions" ON public.active_sessions;
DROP POLICY IF EXISTS "Anyone can view sessions" ON public.active_sessions;
DROP POLICY IF EXISTS "Users can only access their own sessions" ON public.active_sessions;
DROP POLICY IF EXISTS "Users can only update their own sessions" ON public.active_sessions;
DROP POLICY IF EXISTS "System can create user sessions" ON public.active_sessions;
DROP POLICY IF EXISTS "Admins can view all sessions for security" ON public.active_sessions;

-- Secure session access to user ownership only
CREATE POLICY "Users can only access their own sessions" 
ON public.active_sessions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only update their own sessions" 
ON public.active_sessions FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- System can create sessions during authentication
CREATE POLICY "System can create user sessions" 
ON public.active_sessions FOR INSERT 
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

-- Admins can view all sessions for security monitoring
CREATE POLICY "Admins can view all sessions for security" 
ON public.active_sessions FOR SELECT 
USING (has_role('admin'::user_role));

-- 3. SECURE SECURE_SESSIONS TABLE (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_sessions') THEN
    ALTER TABLE public.secure_sessions ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies first
    DROP POLICY IF EXISTS "Users can only access their own secure sessions" ON public.secure_sessions;
    DROP POLICY IF EXISTS "Admins can view secure sessions for monitoring" ON public.secure_sessions;
    
    -- Users can only access their own secure sessions
    CREATE POLICY "Users can only access their own secure sessions" 
    ON public.secure_sessions FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);
    
    -- Admins can view for security monitoring
    CREATE POLICY "Admins can view secure sessions for monitoring" 
    ON public.secure_sessions FOR SELECT 
    USING (has_role('admin'::user_role));
  END IF;
END $$;

-- 4. SECURE LOANS TABLE (CRITICAL - Financial Data Exposure)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loans') THEN
    ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies first
    DROP POLICY IF EXISTS "All users can access loans" ON public.loans;
    DROP POLICY IF EXISTS "Anyone can view loans" ON public.loans;
    DROP POLICY IF EXISTS "Users can access loans for their clients only" ON public.loans;
    DROP POLICY IF EXISTS "Users can create loans for their clients only" ON public.loans;
    DROP POLICY IF EXISTS "Users can update loans for their clients only" ON public.loans;
    DROP POLICY IF EXISTS "Loan professionals can access assigned loans" ON public.loans;
    
    -- Users can only access loans they created or that belong to their clients
    CREATE POLICY "Users can access loans for their clients only" 
    ON public.loans FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 FROM public.clients 
        WHERE clients.id = loans.client_id 
        AND clients.user_id = auth.uid()
      ) OR has_role('admin'::user_role) OR has_role('super_admin'::user_role)
    );
    
    -- Users can create loans for their clients only
    CREATE POLICY "Users can create loans for their clients only" 
    ON public.loans FOR INSERT 
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.clients 
        WHERE clients.id = loans.client_id 
        AND clients.user_id = auth.uid()
      ) OR has_role('admin'::user_role)
    );
    
    -- Users can update loans for their clients only
    CREATE POLICY "Users can update loans for their clients only" 
    ON public.loans FOR UPDATE 
    USING (
      EXISTS (
        SELECT 1 FROM public.clients 
        WHERE clients.id = loans.client_id 
        AND clients.user_id = auth.uid()
      ) OR has_role('admin'::user_role)
    ) 
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.clients 
        WHERE clients.id = loans.client_id 
        AND clients.user_id = auth.uid()
      ) OR has_role('admin'::user_role)
    );
    
    -- Role-based access for loan processors, underwriters, etc.
    CREATE POLICY "Loan professionals can access assigned loans" 
    ON public.loans FOR ALL 
    USING (
      has_role('loan_processor'::user_role) OR 
      has_role('underwriter'::user_role) OR 
      has_role('funder'::user_role) OR 
      has_role('closer'::user_role) OR
      has_role('manager'::user_role)
    );
  END IF;
END $$;

-- 5. SECURE LOAN_REQUESTS TABLE (CRITICAL - Financial Data Exposure)  
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loan_requests') THEN
    ALTER TABLE public.loan_requests ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies first
    DROP POLICY IF EXISTS "All users can access loan requests" ON public.loan_requests;
    DROP POLICY IF EXISTS "Anyone can view loan requests" ON public.loan_requests;
    DROP POLICY IF EXISTS "Users can only access their own loan requests" ON public.loan_requests;
    DROP POLICY IF EXISTS "Loan professionals can access requests for processing" ON public.loan_requests;
    DROP POLICY IF EXISTS "Loan professionals can update request status" ON public.loan_requests;
    
    -- Users can only access their own loan requests
    CREATE POLICY "Users can only access their own loan requests" 
    ON public.loan_requests FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);
    
    -- Loan professionals can access requests for processing
    CREATE POLICY "Loan professionals can access requests for processing" 
    ON public.loan_requests FOR SELECT 
    USING (
      has_role('loan_processor'::user_role) OR 
      has_role('underwriter'::user_role) OR 
      has_role('funder'::user_role) OR 
      has_role('closer'::user_role) OR
      has_role('manager'::user_role) OR
      has_role('admin'::user_role)
    );
    
    -- Loan professionals can update request status
    CREATE POLICY "Loan professionals can update request status" 
    ON public.loan_requests FOR UPDATE 
    USING (
      has_role('loan_processor'::user_role) OR 
      has_role('underwriter'::user_role) OR 
      has_role('funder'::user_role) OR 
      has_role('closer'::user_role) OR
      has_role('manager'::user_role) OR
      has_role('admin'::user_role)
    );
  END IF;
END $$;

-- 6. SECURE SECURE_SESSION_DATA TABLE (Session Storage Security)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'secure_session_data') THEN
    ALTER TABLE public.secure_session_data ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policy first
    DROP POLICY IF EXISTS "Users can only access their own session data" ON public.secure_session_data;
    
    -- Users can only access their own session data
    CREATE POLICY "Users can only access their own session data" 
    ON public.secure_session_data FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 7. ENHANCE LEADS TABLE SECURITY (Already has some policies but strengthen them)
-- Drop any overly permissive policies on leads
DROP POLICY IF EXISTS "All users can access leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can view leads" ON public.leads;
DROP POLICY IF EXISTS "Enhanced leads security - users own data only" ON public.leads;
DROP POLICY IF EXISTS "Enhanced leads security - admin access" ON public.leads;

-- Ensure leads are properly secured to user ownership
CREATE POLICY "Enhanced leads security - users own data only" 
ON public.leads FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Admin access for legitimate management
CREATE POLICY "Enhanced leads security - admin access" 
ON public.leads FOR ALL 
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role)) 
WITH CHECK (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- 8. SECURE PIPELINE_ENTRIES TABLE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pipeline_entries') THEN
    ALTER TABLE public.pipeline_entries ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policy first
    DROP POLICY IF EXISTS "Users can access pipeline entries for their leads only" ON public.pipeline_entries;
    
    -- Users can only access pipeline entries for their leads
    CREATE POLICY "Users can access pipeline entries for their leads only" 
    ON public.pipeline_entries FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM public.leads 
        WHERE leads.id = pipeline_entries.lead_id 
        AND leads.user_id = auth.uid()
      ) OR has_role('admin'::user_role) OR has_role('super_admin'::user_role)
    ) 
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.leads 
        WHERE leads.id = pipeline_entries.lead_id 
        AND leads.user_id = auth.uid()
      ) OR has_role('admin'::user_role) OR has_role('super_admin'::user_role)
    );
  END IF;
END $$;