-- Fix public exposure of document_templates and loan_stages tables

-- 1. Fix document_templates table
DO $$ 
BEGIN
  -- Drop the public SELECT policy if it exists
  DROP POLICY IF EXISTS "Anyone can view active templates" ON public.document_templates;
  DROP POLICY IF EXISTS "Public can view templates" ON public.document_templates;
  DROP POLICY IF EXISTS "Everyone can view templates" ON public.document_templates;
  
  -- Create authenticated-only SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'document_templates' 
    AND policyname = 'Authenticated users can view active templates'
  ) THEN
    CREATE POLICY "Authenticated users can view active templates" 
    ON public.document_templates
    FOR SELECT 
    USING (auth.uid() IS NOT NULL AND is_active = true);
  END IF;
END $$;

-- 2. Fix loan_stages table
DO $$ 
BEGIN
  -- Drop the public SELECT policy if it exists
  DROP POLICY IF EXISTS "Everyone can view active loan stages" ON public.loan_stages;
  DROP POLICY IF EXISTS "Anyone can view loan stages" ON public.loan_stages;
  DROP POLICY IF EXISTS "Public can view stages" ON public.loan_stages;
  
  -- Create authenticated-only SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'loan_stages' 
    AND policyname = 'Authenticated users can view active loan stages'
  ) THEN
    CREATE POLICY "Authenticated users can view active loan stages" 
    ON public.loan_stages
    FOR SELECT 
    USING (auth.uid() IS NOT NULL AND is_active = true);
  END IF;
END $$;