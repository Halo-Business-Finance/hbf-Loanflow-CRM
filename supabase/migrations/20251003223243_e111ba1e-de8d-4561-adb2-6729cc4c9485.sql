-- Comprehensive security lockdown for contact_entities table
-- This table contains: credit scores, income, loan amounts, interest rates, bank details, revenue

-- Drop any potentially weak policies
DROP POLICY IF EXISTS "Secure contact entities select" ON public.contact_entities;
DROP POLICY IF EXISTS "Secure contact entities insert" ON public.contact_entities;
DROP POLICY IF EXISTS "Secure contact entities update" ON public.contact_entities;
DROP POLICY IF EXISTS "Secure contact entities delete" ON public.contact_entities;
DROP POLICY IF EXISTS "ULTIMATE_FORTRESS_super_admin_emergency" ON public.contact_entities;

-- Users can ONLY view their own contacts
CREATE POLICY "Users can view own contacts only"
ON public.contact_entities FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can ONLY insert their own contacts
CREATE POLICY "Users can create own contacts only"
ON public.contact_entities FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can ONLY update their own contacts
CREATE POLICY "Users can update own contacts only"
ON public.contact_entities FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can ONLY delete their own contacts
CREATE POLICY "Users can delete own contacts only"
ON public.contact_entities FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Super admins have full access for support/auditing
CREATE POLICY "Super admins have full contact access"
ON public.contact_entities FOR ALL TO authenticated
USING (public.has_role('super_admin'::public.user_role))
WITH CHECK (public.has_role('super_admin'::public.user_role));

-- Log super admin access to sensitive financial data
CREATE OR REPLACE FUNCTION public.log_sensitive_contact_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role('super_admin'::public.user_role) AND auth.uid() != NEW.user_id THEN
    INSERT INTO public.security_events (user_id, event_type, severity, details)
    VALUES (
      auth.uid(),
      'sensitive_contact_accessed',
      'high',
      jsonb_build_object(
        'contact_id', NEW.id,
        'contact_owner', NEW.user_id,
        'operation', TG_OP,
        'timestamp', now()
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to log super admin access
DROP TRIGGER IF EXISTS log_contact_access ON public.contact_entities;
CREATE TRIGGER log_contact_access
AFTER UPDATE OR DELETE ON public.contact_entities
FOR EACH ROW
EXECUTE FUNCTION public.log_sensitive_contact_access();