-- Step 1: Drop conflicting functions
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS has_role(user_role) CASCADE;

-- Step 2: Create has_role function using existing user_role type
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = true
  )
$$;

-- Step 3: Create text-based helper
CREATE OR REPLACE FUNCTION public.has_role_text(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = _role
      AND is_active = true
  )
$$;

-- Step 4: Fix profiles table - remove overlapping policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role_text(auth.uid(), 'admin') OR public.has_role_text(auth.uid(), 'super_admin'));

CREATE POLICY "profiles_insert_own" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Step 5: Harden audit_logs - make immutable (has user_id)
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

CREATE POLICY "audit_logs_select_own" ON public.audit_logs
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
FOR SELECT TO authenticated
USING (public.has_role_text(auth.uid(), 'admin') OR public.has_role_text(auth.uid(), 'super_admin'));

CREATE POLICY "audit_logs_insert_system" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Step 6: Harden password_history (has user_id)
DROP POLICY IF EXISTS "Users can view own password history" ON public.password_history;
DROP POLICY IF EXISTS "Users can insert own password history" ON public.password_history;

CREATE POLICY "password_history_select_own" ON public.password_history
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "password_history_insert_own" ON public.password_history
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Step 7: Harden encryption_keys - admin only (no user_id column)
DROP POLICY IF EXISTS "Users can view own encryption keys" ON public.encryption_keys;
DROP POLICY IF EXISTS "Users can manage own encryption keys" ON public.encryption_keys;

CREATE POLICY "encryption_keys_admin_only" ON public.encryption_keys
FOR ALL TO authenticated
USING (public.has_role_text(auth.uid(), 'admin') OR public.has_role_text(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role_text(auth.uid(), 'admin') OR public.has_role_text(auth.uid(), 'super_admin'));

-- Step 8: Harden secure_sessions (has user_id)
DROP POLICY IF EXISTS "Users can view own sessions" ON public.secure_sessions;
DROP POLICY IF EXISTS "Users can manage own sessions" ON public.secure_sessions;

CREATE POLICY "secure_sessions_select_own" ON public.secure_sessions
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "secure_sessions_insert_own" ON public.secure_sessions
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "secure_sessions_update_own" ON public.secure_sessions
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "secure_sessions_delete_own" ON public.secure_sessions
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Step 9: Harden rate_limits - admin only (no user_id)
DROP POLICY IF EXISTS "Admins can manage rate limits" ON public.rate_limits;
DROP POLICY IF EXISTS "Users can view rate limits" ON public.rate_limits;

CREATE POLICY "rate_limits_select_all" ON public.rate_limits
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "rate_limits_admin_manage" ON public.rate_limits
FOR ALL TO authenticated
USING (public.has_role_text(auth.uid(), 'admin') OR public.has_role_text(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role_text(auth.uid(), 'admin') OR public.has_role_text(auth.uid(), 'super_admin'));

-- Step 10: Harden integration_connections - created_by column
DROP POLICY IF EXISTS "Users can view own integrations" ON public.integration_connections;
DROP POLICY IF EXISTS "Users can manage own integrations" ON public.integration_connections;

CREATE POLICY "integration_connections_select_own" ON public.integration_connections
FOR SELECT TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "integration_connections_insert_own" ON public.integration_connections
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "integration_connections_update_own" ON public.integration_connections
FOR UPDATE TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "integration_connections_delete_own" ON public.integration_connections
FOR DELETE TO authenticated
USING (auth.uid() = created_by);

-- Step 11: Harden user_roles
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "user_roles_select_own" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "user_roles_select_admin" ON public.user_roles
FOR SELECT TO authenticated
USING (public.has_role_text(auth.uid(), 'admin') OR public.has_role_text(auth.uid(), 'super_admin'));

CREATE POLICY "user_roles_super_admin_manage" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role_text(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role_text(auth.uid(), 'super_admin'));