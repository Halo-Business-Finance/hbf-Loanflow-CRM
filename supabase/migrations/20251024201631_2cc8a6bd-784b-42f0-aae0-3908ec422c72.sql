-- ============================================================================
-- FIXED: RLS Policy Enhancement without workflow_executions changes
-- Date: 2025-10-24
-- Purpose: Fix critical security vulnerabilities (avoiding schema conflicts)
-- ============================================================================

-- ======================
-- Part 1: Secure Workflow RLS (admin-only, no column dependencies)
-- ======================

-- Drop overly permissive workflow policies
DROP POLICY IF EXISTS "Anyone can view active workflows" ON workflows;

-- Create secure admin-only policies
CREATE POLICY "Admins can manage all workflows"
  ON workflows
  FOR ALL
  USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "Managers can view workflows"
  ON workflows
  FOR SELECT
  USING (has_role('manager'::user_role) OR has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- ======================
-- Part 2: Secure Custom Objects
-- ======================

DROP POLICY IF EXISTS "Anyone can view custom objects" ON custom_objects;

CREATE POLICY "Authenticated users can view custom objects"
  ON custom_objects
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ======================
-- Part 3: MFA Enforcement Functions  
-- ======================

CREATE OR REPLACE FUNCTION require_mfa_for_operation(
  p_user_id UUID,
  p_operation_type TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mfa_enabled BOOLEAN;
  v_mfa_verified_recently BOOLEAN;
  v_user_role user_role;
BEGIN
  SELECT role INTO v_user_role
  FROM user_roles
  WHERE user_id = p_user_id
  LIMIT 1;
  
  SELECT 
    totp_enabled OR backup_codes IS NOT NULL
  INTO v_mfa_enabled
  FROM mfa_settings
  WHERE user_id = p_user_id;
  
  IF v_user_role IN ('admin', 'super_admin') THEN
    IF p_operation_type IN ('user_creation', 'user_deletion', 'role_change', 'password_reset') THEN
      SELECT EXISTS(
        SELECT 1
        FROM security_events
        WHERE user_id = p_user_id
          AND event_type = 'mfa_verified'
          AND created_at > NOW() - INTERVAL '5 minutes'
      ) INTO v_mfa_verified_recently;
      
      RETURN COALESCE(v_mfa_verified_recently, FALSE);
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION log_mfa_verification(
  p_user_id UUID,
  p_method TEXT,
  p_success BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO security_events (user_id, event_type, severity, details)
  VALUES (
    p_user_id,
    'mfa_verification_attempt',
    CASE WHEN p_success THEN 'low' ELSE 'high' END,
    jsonb_build_object(
      'method', p_method,
      'success', p_success,
      'timestamp', NOW()
    )
  );
  
  IF p_success THEN
    INSERT INTO security_events (user_id, event_type, severity, details)
    VALUES (
      p_user_id,
      'mfa_verified',
      'low',
      jsonb_build_object(
        'method', p_method,
        'timestamp', NOW()
      )
    );
  END IF;
END;
$$;

-- ======================
-- Part 4: Server-Side Secure Session Storage
-- ======================

CREATE TABLE IF NOT EXISTS secure_session_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_key TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
  UNIQUE(user_id, session_key)
);

ALTER TABLE secure_session_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own session data"
  ON secure_session_data
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_secure_session_user_key ON secure_session_data(user_id, session_key);
CREATE INDEX IF NOT EXISTS idx_secure_session_expires ON secure_session_data(expires_at) WHERE expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION store_secure_session_data(
  p_key TEXT,
  p_value TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO secure_session_data (user_id, session_key, encrypted_value, expires_at)
  VALUES (auth.uid(), p_key, p_value, NOW() + INTERVAL '1 hour')
  ON CONFLICT (user_id, session_key) 
  DO UPDATE SET 
    encrypted_value = EXCLUDED.encrypted_value,
    expires_at = EXCLUDED.expires_at,
    created_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION get_secure_session_data(
  p_key TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT encrypted_value INTO v_value
  FROM secure_session_data
  WHERE user_id = auth.uid()
    AND session_key = p_key
    AND (expires_at IS NULL OR expires_at > NOW());
  
  RETURN v_value;
END;
$$;

CREATE OR REPLACE FUNCTION remove_secure_session_data(
  p_key TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM secure_session_data
  WHERE user_id = auth.uid()
    AND session_key = p_key;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_expired_session_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM secure_session_data
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW() - INTERVAL '1 day';
END;
$$;

-- ======================
-- Part 5: Audit Logging
-- ======================

INSERT INTO audit_logs (user_id, action, table_name, new_values)
VALUES (
  NULL,
  'security_fix_deployment',
  'system_wide',
  jsonb_build_object(
    'timestamp', NOW(),
    'changes', jsonb_build_array(
      'Secured workflow RLS policies (admin-only management)',
      'Added MFA enforcement for admin operations',
      'Created server-side secure session storage',
      'Removed client-side fortress-security dependencies'
    ),
    'security_score_improvement', 'High',
    'vulnerability_fixes', jsonb_build_array(
      'Overly permissive workflow access',
      'Missing MFA enforcement',
      'Client-side encryption key storage'
    )
  )
);