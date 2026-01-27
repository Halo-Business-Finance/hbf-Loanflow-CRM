-- Fix user_behavior_patterns RLS policies for proper access control
-- Current issue: "System can manage behavior patterns FOR ALL USING (true)" 
-- allows any user to access/modify all behavioral data

-- 1) Remove the overly permissive policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_behavior_patterns' 
      AND policyname='System can manage behavior patterns'
  ) THEN
    EXECUTE 'DROP POLICY "System can manage behavior patterns" ON public.user_behavior_patterns';
  END IF;
END $$;

-- 2) Ensure RLS is enabled
ALTER TABLE public.user_behavior_patterns ENABLE ROW LEVEL SECURITY;

-- 3) Create secure policies - users can only access their own data
-- Users can INSERT their own behavior patterns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_behavior_patterns' 
      AND policyname='Users can insert their own behavior patterns'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert their own behavior patterns" ON public.user_behavior_patterns FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

-- Users can UPDATE their own behavior patterns (if needed for corrections)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_behavior_patterns' 
      AND policyname='Users can update their own behavior patterns'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their own behavior patterns" ON public.user_behavior_patterns FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

-- Enhance existing SELECT policy to also allow admins
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_behavior_patterns' 
      AND policyname='Users can view their own behavior patterns'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view their own behavior patterns" ON public.user_behavior_patterns';
  END IF;
END $$;

-- Create enhanced SELECT policy
CREATE POLICY "Users and admins can view behavior patterns"
ON public.user_behavior_patterns
FOR SELECT
USING (
  auth.uid() = user_id OR 
  has_role('admin'::user_role) OR 
  has_role('super_admin'::user_role)
);

-- Only admins can DELETE behavior patterns (for data cleanup/privacy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_behavior_patterns' 
      AND policyname='Admins can delete behavior patterns'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can delete behavior patterns" ON public.user_behavior_patterns FOR DELETE USING (has_role(''admin''::user_role) OR has_role(''super_admin''::user_role))';
  END IF;
END $$;

-- Log the security fix
INSERT INTO public.audit_logs (
  action, table_name, new_values
) VALUES (
  'security_fix_behavior_patterns_rls', 
  'user_behavior_patterns',
  jsonb_build_object(
    'description', 'Fixed overly permissive RLS policies on user_behavior_patterns',
    'fix_applied_at', now(),
    'security_level', 'critical'
  )
);