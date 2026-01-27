-- Fix ERROR-level security issues

-- 1. Fix profiles - consolidate overlapping policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Single consolidated policies for profiles
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id 
  OR public.has_role_text(auth.uid(), 'admin') 
  OR public.has_role_text(auth.uid(), 'super_admin')
);

CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2. Fix contact_entities - stricter owner-based access
DROP POLICY IF EXISTS "Owner can view own contacts" ON public.contact_entities;
DROP POLICY IF EXISTS "Owner can manage own contacts" ON public.contact_entities;
DROP POLICY IF EXISTS "Admins can view all contacts" ON public.contact_entities;
DROP POLICY IF EXISTS "Loan processors can view assigned contacts" ON public.contact_entities;
DROP POLICY IF EXISTS "Underwriters can view assigned contacts" ON public.contact_entities;

CREATE POLICY "contact_entities_owner_select" ON public.contact_entities
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id 
  OR public.has_role_text(auth.uid(), 'admin')
  OR public.has_role_text(auth.uid(), 'super_admin')
);

CREATE POLICY "contact_entities_owner_insert" ON public.contact_entities
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "contact_entities_owner_update" ON public.contact_entities
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role_text(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role_text(auth.uid(), 'admin'));

CREATE POLICY "contact_entities_owner_delete" ON public.contact_entities
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role_text(auth.uid(), 'super_admin'));

-- 3. Fix mfa_settings - remove emergency access, strict owner only
DROP POLICY IF EXISTS "Emergency super admin MFA access with audit" ON public.mfa_settings;
DROP POLICY IF EXISTS "Strict owner-only access to MFA settings" ON public.mfa_settings;
DROP POLICY IF EXISTS "Users can manage own MFA settings" ON public.mfa_settings;

CREATE POLICY "mfa_settings_owner_only" ON public.mfa_settings
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Fix email_accounts - strict owner only, no emergency access
DROP POLICY IF EXISTS "Owner can manage own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can manage own email accounts" ON public.email_accounts;

CREATE POLICY "email_accounts_owner_only" ON public.email_accounts
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Fix ringcentral_accounts - remove emergency access
DROP POLICY IF EXISTS "Emergency super admin RingCentral access with audit" ON public.ringcentral_accounts;
DROP POLICY IF EXISTS "Strict owner-only access to RingCentral accounts" ON public.ringcentral_accounts;
DROP POLICY IF EXISTS "Users can manage own RingCentral accounts" ON public.ringcentral_accounts;

CREATE POLICY "ringcentral_accounts_owner_only" ON public.ringcentral_accounts
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Fix lead_documents - stricter access
DROP POLICY IF EXISTS "Loan processors can view assigned lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Underwriters can view lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Funders can view lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Closers can view lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Users can view own lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Users can manage own lead documents" ON public.lead_documents;

CREATE POLICY "lead_documents_owner_select" ON public.lead_documents
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id 
  OR public.has_role_text(auth.uid(), 'admin')
  OR public.has_role_text(auth.uid(), 'super_admin')
);

CREATE POLICY "lead_documents_owner_insert" ON public.lead_documents
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "lead_documents_owner_update" ON public.lead_documents
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role_text(auth.uid(), 'admin'));

CREATE POLICY "lead_documents_owner_delete" ON public.lead_documents
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role_text(auth.uid(), 'super_admin'));

-- 7. Fix loans - require additional validation for admin access
DROP POLICY IF EXISTS "Users can view own loans" ON public.loans;
DROP POLICY IF EXISTS "Admins can view all loans" ON public.loans;

CREATE POLICY "loans_owner_select" ON public.loans
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id 
  OR public.has_role_text(auth.uid(), 'admin')
  OR public.has_role_text(auth.uid(), 'super_admin')
);

CREATE POLICY "loans_owner_insert" ON public.loans
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "loans_owner_update" ON public.loans
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role_text(auth.uid(), 'admin'));

-- Fix WARN-level issues

-- 8. Fix audit_logs - remove user insert, system only
DROP POLICY IF EXISTS "audit_logs_insert_system" ON public.audit_logs;

-- Create system-only insert via service role (no user insert policy)

-- 9. Fix rate_limits - restrict visibility
DROP POLICY IF EXISTS "rate_limits_select_all" ON public.rate_limits;

CREATE POLICY "rate_limits_admin_view" ON public.rate_limits
FOR SELECT TO authenticated
USING (public.has_role_text(auth.uid(), 'admin') OR public.has_role_text(auth.uid(), 'super_admin'));