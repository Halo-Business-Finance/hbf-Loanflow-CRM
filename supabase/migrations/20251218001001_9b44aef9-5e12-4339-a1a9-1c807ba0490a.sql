-- Secure the email_accounts_secure view by recreating it with explicit security
-- The underlying email_accounts table already has proper RLS, but we'll add additional safeguards

-- Drop and recreate the view with security_barrier option for extra protection
DROP VIEW IF EXISTS email_accounts_secure;

CREATE VIEW email_accounts_secure WITH (security_barrier = true) AS
SELECT 
    id,
    user_id,
    email_address,
    display_name,
    expires_at,
    is_active,
    created_at,
    updated_at
FROM email_accounts
WHERE user_id = auth.uid() OR has_role('admin') OR has_role('super_admin');

-- Add comment explaining the security model
COMMENT ON VIEW email_accounts_secure IS 'Secure view of email_accounts that excludes sensitive OAuth tokens and enforces user-level access control via security_barrier';

-- Grant appropriate permissions
GRANT SELECT ON email_accounts_secure TO authenticated;