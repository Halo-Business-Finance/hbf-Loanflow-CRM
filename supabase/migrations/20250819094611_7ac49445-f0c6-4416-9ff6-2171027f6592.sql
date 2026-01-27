-- Carefully fix the get_user_role function with CASCADE and recreate policies

-- First, drop the function with CASCADE to remove dependent policies
DROP FUNCTION IF EXISTS public.get_user_role(UUID) CASCADE;

-- Recreate the function with correct return type and search path
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID DEFAULT auth.uid())
RETURNS public.user_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = p_user_id AND is_active = true LIMIT 1),
    'viewer'::public.user_role
  );
$$;

-- Recreate the policies that were dropped
CREATE POLICY "Only admins can view account lockouts" 
ON public.account_lockouts
FOR SELECT
USING (public.get_user_role() = ANY (ARRAY['admin'::public.user_role, 'super_admin'::public.user_role]));

-- Recreate lead_documents policies if they were dropped
CREATE POLICY "Secure lead document viewing"
ON public.lead_documents
FOR SELECT
USING (
  CASE
    WHEN public.get_user_role() IN ('admin'::public.user_role, 'super_admin'::public.user_role) THEN true
    ELSE (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_documents.lead_id 
        AND l.user_id = auth.uid()
      )
    )
  END
);

CREATE POLICY "Secure lead document updates"
ON public.lead_documents
FOR UPDATE
USING (
  CASE
    WHEN public.get_user_role() IN ('admin'::public.user_role, 'super_admin'::public.user_role) THEN true
    ELSE (
      user_id = auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_documents.lead_id 
        AND l.user_id = auth.uid()
      )
    )
  END
);

CREATE POLICY "Secure lead document deletion"
ON public.lead_documents
FOR DELETE
USING (
  CASE
    WHEN public.get_user_role() IN ('admin'::public.user_role, 'super_admin'::public.user_role) THEN true
    ELSE (
      user_id = auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_documents.lead_id 
        AND l.user_id = auth.uid()
      )
    )
  END
);

-- Recreate profiles policy if it was dropped
CREATE POLICY "Secure profile access"
ON public.profiles
FOR SELECT
USING (
  CASE
    WHEN public.get_user_role() IN ('admin'::public.user_role, 'super_admin'::public.user_role) THEN true
    ELSE id = auth.uid()
  END
);