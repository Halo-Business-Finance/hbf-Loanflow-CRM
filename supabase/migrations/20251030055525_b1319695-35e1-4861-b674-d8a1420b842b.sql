-- Allow team members (all roles) to view unassigned leads for assignment purposes
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'leads' 
    AND policyname = 'Team members can view unassigned leads for assignment'
    AND schemaname = 'public'
  ) THEN
    CREATE POLICY "Team members can view unassigned leads for assignment" 
    ON public.leads 
    FOR SELECT 
    USING (
      user_id IS NULL 
      AND auth.uid() IS NOT NULL
    );
  END IF;
END $$;