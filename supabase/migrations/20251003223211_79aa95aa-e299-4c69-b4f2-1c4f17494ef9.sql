-- Secure lead_documents table - only document owners and super admins can access
DROP POLICY IF EXISTS "Users can view their own documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Users can upload documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Users can delete their documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Admins can view all documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Super admins can manage all documents" ON public.lead_documents;

-- Users can only view documents for their own leads
CREATE POLICY "Users can view own lead documents"
ON public.lead_documents FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_documents.lead_id
    AND l.user_id = auth.uid()
  )
);

-- Users can upload documents to their own leads
CREATE POLICY "Users can upload to own leads"
ON public.lead_documents FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_documents.lead_id
    AND l.user_id = auth.uid()
  )
);

-- Users can delete documents from their own leads
CREATE POLICY "Users can delete own lead documents"
ON public.lead_documents FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_documents.lead_id
    AND l.user_id = auth.uid()
  )
);

-- Super admins can manage all documents
CREATE POLICY "Super admins can manage all documents"
ON public.lead_documents FOR ALL TO authenticated
USING (public.has_role('super_admin'::public.user_role))
WITH CHECK (public.has_role('super_admin'::public.user_role));

-- Secure loan_requests table with stricter validation
DROP POLICY IF EXISTS "FORTRESS_loan_requests_owner_access" ON public.loan_requests;
DROP POLICY IF EXISTS "FORTRESS_loan_requests_super_admin_emergency" ON public.loan_requests;
DROP POLICY IF EXISTS "Users can view own loan requests" ON public.loan_requests;
DROP POLICY IF EXISTS "Users can create loan requests" ON public.loan_requests;
DROP POLICY IF EXISTS "Users can update own loan requests" ON public.loan_requests;
DROP POLICY IF EXISTS "Super admins can manage loan requests" ON public.loan_requests;

-- Users can only view their own loan requests
CREATE POLICY "Users can view own loan requests"
ON public.loan_requests FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = loan_requests.lead_id
    AND l.user_id = auth.uid()
  )
);

-- Users can create loan requests for their own leads
CREATE POLICY "Users can create loan requests"
ON public.loan_requests FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = loan_requests.lead_id
    AND l.user_id = auth.uid()
  )
);

-- Users can update their own loan requests
CREATE POLICY "Users can update own loan requests"
ON public.loan_requests FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = loan_requests.lead_id
    AND l.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = loan_requests.lead_id
    AND l.user_id = auth.uid()
  )
);

-- Super admins with enhanced logging
CREATE POLICY "Super admins can manage loan requests"
ON public.loan_requests FOR ALL TO authenticated
USING (public.has_role('super_admin'::public.user_role))
WITH CHECK (public.has_role('super_admin'::public.user_role));

-- Log super admin access to loan requests
CREATE OR REPLACE FUNCTION public.log_loan_request_admin_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role('super_admin'::public.user_role) THEN
    INSERT INTO public.security_events (user_id, event_type, severity, details)
    VALUES (
      auth.uid(),
      'super_admin_loan_access',
      'critical',
      jsonb_build_object(
        'loan_request_id', COALESCE(NEW.id, OLD.id),
        'operation', TG_OP,
        'timestamp', now()
      )
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS log_admin_loan_access ON public.loan_requests;
CREATE TRIGGER log_admin_loan_access
AFTER INSERT OR UPDATE OR DELETE ON public.loan_requests
FOR EACH ROW
EXECUTE FUNCTION public.log_loan_request_admin_access();