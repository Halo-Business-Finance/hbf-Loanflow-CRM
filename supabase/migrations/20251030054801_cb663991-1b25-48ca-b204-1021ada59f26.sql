-- Allow managers and admins to view unassigned leads (where user_id IS NULL)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'leads' 
    AND policyname = 'Managers and admins can view unassigned leads'
    AND schemaname = 'public'
  ) THEN
    CREATE POLICY "Managers and admins can view unassigned leads" 
    ON public.leads 
    FOR SELECT 
    USING (
      user_id IS NULL 
      AND (
        has_role('manager'::user_role) 
        OR has_role('admin'::user_role) 
        OR has_role('super_admin'::user_role)
      )
    );
  END IF;
END $$;