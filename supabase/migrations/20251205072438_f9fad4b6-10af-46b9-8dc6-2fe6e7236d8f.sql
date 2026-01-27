-- Security fixes: Remove overly permissive RLS policies
-- These policies grant broader access than necessary and proper policies already exist

-- 1. Fix leads excessive role access
-- The "Users view own leads, managers view all" policy already provides proper access control
DROP POLICY IF EXISTS "Authenticated users with roles can view all leads" ON public.leads;

-- 2. Fix profiles public exposure  
-- The "Profiles - users can view own or admins" policy already provides proper access control
DROP POLICY IF EXISTS "Authenticated users can view active team profiles" ON public.profiles;

-- 3. Fix MFA unaudited emergency access
-- The "Emergency super admin MFA access with audit" policy provides proper audited access
DROP POLICY IF EXISTS "Super admin MFA emergency access" ON public.mfa_settings;

-- Add comments documenting the security model
COMMENT ON TABLE public.leads IS 'Lead access: Users see own leads, managers/admins see all, unassigned leads visible only to managers+';
COMMENT ON TABLE public.profiles IS 'Profile access: Users see own profile, admins see all active profiles';
COMMENT ON TABLE public.mfa_settings IS 'MFA settings: Users manage own, super admins can access with mandatory audit logging';