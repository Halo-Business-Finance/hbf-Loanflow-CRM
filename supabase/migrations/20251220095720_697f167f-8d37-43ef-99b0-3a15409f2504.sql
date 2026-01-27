-- Make the view respect RLS policies of the underlying table
ALTER VIEW public.email_accounts_secure SET (security_invoker = true);