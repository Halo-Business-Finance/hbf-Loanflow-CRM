-- Comprehensive security fix - corrected for actual table schemas
-- Only fix tables that actually exist with proper column references

-- 1) CRITICAL: Secure security_headers table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_headers') THEN
    ALTER TABLE public.security_headers ENABLE ROW LEVEL SECURITY;
    
    -- Drop the permissive policy
    EXECUTE 'DROP POLICY IF EXISTS "All users can view security headers" ON public.security_headers';
    
    -- Create admin-only policy
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='security_headers' 
        AND policyname='Admins can manage security headers'
    ) THEN
      EXECUTE 'CREATE POLICY "Admins can manage security headers" ON public.security_headers FOR ALL USING (has_role(''admin''::user_role) OR has_role(''super_admin''::user_role))';
    END IF;
  END IF;
END $$;

-- 2) Secure approval_processes table (this one we know exists and has proper columns)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'approval_processes') THEN
    ALTER TABLE public.approval_processes ENABLE ROW LEVEL SECURITY;
    
    -- Drop any potential public policies
    EXECUTE 'DROP POLICY IF EXISTS "All users can view approval processes" ON public.approval_processes';
    EXECUTE 'DROP POLICY IF EXISTS "Public can view approval processes" ON public.approval_processes';
    
    -- The current policy "Users can view approval processes" is already restrictive
    -- but let's ensure proper admin management exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='approval_processes' 
        AND policyname='Admins can manage approval processes'
    ) THEN
      EXECUTE 'CREATE POLICY "Admins can manage approval processes" ON public.approval_processes FOR ALL USING (has_role(''admin''::user_role) OR has_role(''super_admin''::user_role))';
    END IF;
  END IF;
END $$;

-- Log the security fixes that were successfully applied
INSERT INTO public.audit_logs (
  action, table_name, new_values
) VALUES (
  'security_fix_business_data_exposure', 
  'security_headers_approval_processes',
  jsonb_build_object(
    'description', 'Secured security configuration and approval process tables',
    'tables_fixed', ARRAY['security_headers', 'approval_processes'],
    'fix_applied_at', now(),
    'security_level', 'critical',
    'impact', 'Prevented security config exposure and protected approval workflows'
  )
);