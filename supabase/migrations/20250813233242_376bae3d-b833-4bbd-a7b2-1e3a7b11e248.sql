-- CRITICAL SECURITY FIX: Secure contact_entities table from data theft
-- This table contains highly sensitive customer PII that must be protected

-- First, ensure RLS is enabled
ALTER TABLE public.contact_entities ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh with secure policies
DROP POLICY IF EXISTS "Admins can manage all contact entities" ON public.contact_entities;
DROP POLICY IF EXISTS "Restricted admin access to contact entities" ON public.contact_entities;
DROP POLICY IF EXISTS "Super admins can manage all contact entities" ON public.contact_entities;
DROP POLICY IF EXISTS "Super admins can view all contact entities" ON public.contact_entities;
DROP POLICY IF EXISTS "Users can create contact entities" ON public.contact_entities;
DROP POLICY IF EXISTS "Users can delete their own contact entities" ON public.contact_entities;
DROP POLICY IF EXISTS "Users can update their own contact entities" ON public.contact_entities;
DROP POLICY IF EXISTS "Users can view their own contact entities" ON public.contact_entities;

-- Create NEW secure policies with principle of least privilege

-- 1. Users can only view their OWN contact entities
CREATE POLICY "Users can view only their own contact entities" 
ON public.contact_entities FOR SELECT 
USING (auth.uid() = user_id);

-- 2. Users can only create contact entities assigned to themselves
CREATE POLICY "Users can create contact entities for themselves only" 
ON public.contact_entities FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. Users can only update their OWN contact entities
CREATE POLICY "Users can update only their own contact entities" 
ON public.contact_entities FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 4. Users can only delete their OWN contact entities
CREATE POLICY "Users can delete only their own contact entities" 
ON public.contact_entities FOR DELETE 
USING (auth.uid() = user_id);

-- 5. Super admins get full access for administrative purposes
CREATE POLICY "Super admins have full contact entity access" 
ON public.contact_entities FOR ALL 
USING (has_role('super_admin'::user_role)) 
WITH CHECK (has_role('super_admin'::user_role));

-- Also secure lead_documents table while we're at it
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_documents') THEN
    ALTER TABLE public.lead_documents ENABLE ROW LEVEL SECURITY;
    
    -- Drop any overly permissive policies
    EXECUTE 'DROP POLICY IF EXISTS "All users can manage lead documents" ON public.lead_documents';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can access lead documents" ON public.lead_documents';
    
    -- Secure access to lead documents
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='lead_documents' 
        AND policyname='Users can only access their own lead documents'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can only access their own lead documents" ON public.lead_documents FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.leads 
          WHERE leads.id = lead_documents.lead_id 
          AND leads.user_id = auth.uid()
        ) OR has_role(''super_admin''::user_role)
      )';
    END IF;
  END IF;
END $$;

-- Log the critical security fix
INSERT INTO public.audit_logs (
  action, table_name, new_values
) VALUES (
  'critical_customer_data_security_fix', 
  'contact_entities',
  jsonb_build_object(
    'description', 'Implemented strict ownership-based access to prevent customer data theft',
    'security_level', 'critical',
    'threat_prevented', 'Unauthorized access to customer emails, phone numbers, credit scores, and business data',
    'policies_implemented', ARRAY[
      'Users can only view their own contact entities',
      'Users can only create/update/delete their own data',
      'Super admin access for legitimate administrative needs',
      'Lead documents secured to prevent document theft'
    ],
    'compliance_improved', 'Customer PII protection according to data privacy regulations',
    'timestamp', now()
  )
);