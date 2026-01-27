-- Comprehensive security fix for profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "System can create profiles" ON public.profiles;

-- Users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Users can update their own profile  
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role('super_admin'::public.user_role));

-- Super admins can update all profiles
CREATE POLICY "Super admins can update all profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role('super_admin'::public.user_role))
WITH CHECK (public.has_role('super_admin'::public.user_role));

-- System can insert profiles (during signup)
CREATE POLICY "System can create profiles"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Comprehensive security fix for audit_logs table
DROP POLICY IF EXISTS "Secure audit logs access" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Only super admins can view audit logs" ON public.audit_logs;

-- Only super admins can view audit logs
CREATE POLICY "Only super admins can view audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.has_role('super_admin'::public.user_role));

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);