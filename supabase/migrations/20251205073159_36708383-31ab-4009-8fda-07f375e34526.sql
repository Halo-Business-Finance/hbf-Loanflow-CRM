-- Fix SECURITY DEFINER view warning
-- Change the view to use SECURITY INVOKER so it respects the querying user's permissions
ALTER VIEW public.email_accounts_secure SET (security_invoker = on);