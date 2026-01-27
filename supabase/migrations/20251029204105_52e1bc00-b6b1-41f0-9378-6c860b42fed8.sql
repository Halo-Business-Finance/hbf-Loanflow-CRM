-- ============================================
-- TARGETED RLS POLICY ENHANCEMENT (v2)
-- Adds missing granular policies for better security
-- ============================================

-- Function to create policy if it doesn't exist
CREATE OR REPLACE FUNCTION create_policy_if_not_exists(
  p_table_name text,
  p_policy_name text,
  p_policy_definition text
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = p_table_name 
      AND policyname = p_policy_name
  ) THEN
    EXECUTE p_policy_definition;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 1. USER_SETTINGS: Add granular CRUD policies
SELECT create_policy_if_not_exists('user_settings', 'Users can view own settings',
  'CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id)');
SELECT create_policy_if_not_exists('user_settings', 'Users can insert own settings',
  'CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT create_policy_if_not_exists('user_settings', 'Users can update own settings',
  'CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id)');
SELECT create_policy_if_not_exists('user_settings', 'Users can delete own settings',
  'CREATE POLICY "Users can delete own settings" ON public.user_settings FOR DELETE USING (auth.uid() = user_id)');

-- 2. ENCRYPTION_KEYS: Super critical - strict admin-only access
SELECT create_policy_if_not_exists('encryption_keys', 'Only admins can view encryption keys',
  'CREATE POLICY "Only admins can view encryption keys" ON public.encryption_keys FOR SELECT USING (public.has_role(''admin''::public.user_role))');
SELECT create_policy_if_not_exists('encryption_keys', 'Only super admins can insert encryption keys',
  'CREATE POLICY "Only super admins can insert encryption keys" ON public.encryption_keys FOR INSERT WITH CHECK (public.has_role(''super_admin''::public.user_role))');
SELECT create_policy_if_not_exists('encryption_keys', 'Only super admins can update encryption keys',
  'CREATE POLICY "Only super admins can update encryption keys" ON public.encryption_keys FOR UPDATE USING (public.has_role(''super_admin''::public.user_role))');
SELECT create_policy_if_not_exists('encryption_keys', 'Only super admins can delete encryption keys',
  'CREATE POLICY "Only super admins can delete encryption keys" ON public.encryption_keys FOR DELETE USING (public.has_role(''super_admin''::public.user_role))');

-- 3. SESSION_CONFIG: Add missing policies
SELECT create_policy_if_not_exists('session_config', 'Admins can view session config',
  'CREATE POLICY "Admins can view session config" ON public.session_config FOR SELECT USING (public.has_role(''admin''::public.user_role))');
SELECT create_policy_if_not_exists('session_config', 'Super admins can insert session config',
  'CREATE POLICY "Super admins can insert session config" ON public.session_config FOR INSERT WITH CHECK (public.has_role(''super_admin''::public.user_role))');
SELECT create_policy_if_not_exists('session_config', 'Super admins can update session config',
  'CREATE POLICY "Super admins can update session config" ON public.session_config FOR UPDATE USING (public.has_role(''super_admin''::public.user_role))');

-- 4. API_REQUEST_ANALYTICS: Add missing policies
SELECT create_policy_if_not_exists('api_request_analytics', 'System can log API requests',
  'CREATE POLICY "System can log API requests" ON public.api_request_analytics FOR INSERT WITH CHECK (true)');
SELECT create_policy_if_not_exists('api_request_analytics', 'Admins can update API analytics',
  'CREATE POLICY "Admins can update API analytics" ON public.api_request_analytics FOR UPDATE USING (public.has_role(''admin''::public.user_role))');

-- 5. CUSTOM_FIELDS: Add granular policies
SELECT create_policy_if_not_exists('custom_fields', 'Users can view custom fields',
  'CREATE POLICY "Users can view custom fields" ON public.custom_fields FOR SELECT USING (auth.uid() IS NOT NULL)');
SELECT create_policy_if_not_exists('custom_fields', 'Managers can insert custom fields',
  'CREATE POLICY "Managers can insert custom fields" ON public.custom_fields FOR INSERT WITH CHECK (public.has_role(''manager''::public.user_role))');
SELECT create_policy_if_not_exists('custom_fields', 'Managers can update custom fields',
  'CREATE POLICY "Managers can update custom fields" ON public.custom_fields FOR UPDATE USING (public.has_role(''manager''::public.user_role))');

-- 6. LEAD_SCORING_MODELS: Add granular policies
SELECT create_policy_if_not_exists('lead_scoring_models', 'Users can view scoring models',
  'CREATE POLICY "Users can view scoring models" ON public.lead_scoring_models FOR SELECT USING (auth.uid() IS NOT NULL)');
SELECT create_policy_if_not_exists('lead_scoring_models', 'Managers can create scoring models',
  'CREATE POLICY "Managers can create scoring models" ON public.lead_scoring_models FOR INSERT WITH CHECK (public.has_role(''manager''::public.user_role))');
SELECT create_policy_if_not_exists('lead_scoring_models', 'Managers can update scoring models',
  'CREATE POLICY "Managers can update scoring models" ON public.lead_scoring_models FOR UPDATE USING (public.has_role(''manager''::public.user_role))');
SELECT create_policy_if_not_exists('lead_scoring_models', 'Admins can delete scoring models',
  'CREATE POLICY "Admins can delete scoring models" ON public.lead_scoring_models FOR DELETE USING (public.has_role(''admin''::public.user_role))');

-- 7. ROLE_CHANGE_MFA_VERIFICATIONS: Add granular policies
SELECT create_policy_if_not_exists('role_change_mfa_verifications', 'Users can view own MFA verifications',
  'CREATE POLICY "Users can view own MFA verifications" ON public.role_change_mfa_verifications FOR SELECT USING (auth.uid() = user_id)');
SELECT create_policy_if_not_exists('role_change_mfa_verifications', 'System can create MFA verifications',
  'CREATE POLICY "System can create MFA verifications" ON public.role_change_mfa_verifications FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT create_policy_if_not_exists('role_change_mfa_verifications', 'System can update MFA verifications',
  'CREATE POLICY "System can update MFA verifications" ON public.role_change_mfa_verifications FOR UPDATE USING (auth.uid() = user_id)');
SELECT create_policy_if_not_exists('role_change_mfa_verifications', 'System can cleanup expired MFA',
  'CREATE POLICY "System can cleanup expired MFA" ON public.role_change_mfa_verifications FOR DELETE USING (expires_at < NOW() OR auth.uid() = user_id)');

-- Cleanup helper function
DROP FUNCTION IF EXISTS create_policy_if_not_exists(text, text, text);