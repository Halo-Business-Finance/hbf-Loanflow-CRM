-- Fix the view to use SECURITY INVOKER (runs with caller's permissions)
-- This ensures the view respects the caller's RLS policies

DROP VIEW IF EXISTS email_accounts_secure;

-- Recreate view with SECURITY INVOKER (the default, but explicit for clarity)
-- security_barrier prevents optimizer from pushing down potentially leaky predicates
CREATE VIEW email_accounts_secure 
WITH (security_barrier = true, security_invoker = true) AS
SELECT 
    id,
    user_id,
    email_address,
    display_name,
    expires_at,
    is_active,
    created_at,
    updated_at
FROM email_accounts;

-- The underlying email_accounts table has RLS policies that restrict access:
-- - Users can only see their own accounts (user_id = auth.uid())
-- - Admins can see all accounts
-- So this view inherits that security automatically

COMMENT ON VIEW email_accounts_secure IS 'Secure view of email_accounts excluding OAuth tokens. Access controlled by underlying table RLS policies.';

GRANT SELECT ON email_accounts_secure TO authenticated;