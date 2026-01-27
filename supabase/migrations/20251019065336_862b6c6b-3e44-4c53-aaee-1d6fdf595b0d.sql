-- Secure document_templates and loan_stages tables
-- These tables contain sensitive business data and should not be publicly accessible

-- Fix document_templates RLS policies
DROP POLICY IF EXISTS "Public can view active templates" ON public.document_templates;
DROP POLICY IF EXISTS "Public can view templates" ON public.document_templates;
DROP POLICY IF EXISTS "Authenticated users can view templates" ON public.document_templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON public.document_templates;

-- Create secure policies for document_templates
CREATE POLICY "Authenticated users can view templates"
  ON public.document_templates
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage templates"
  ON public.document_templates
  FOR ALL
  USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- Fix loan_stages RLS policies
DROP POLICY IF EXISTS "Public can view loan stages" ON public.loan_stages;
DROP POLICY IF EXISTS "Authenticated users can view loan stages" ON public.loan_stages;
DROP POLICY IF EXISTS "Admins can manage loan stages" ON public.loan_stages;

-- Create secure policies for loan_stages
CREATE POLICY "Authenticated users can view loan stages"
  ON public.loan_stages
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage loan stages"
  ON public.loan_stages
  FOR ALL
  USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));