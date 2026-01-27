-- Fix security warnings by setting search_path on functions

-- Update security definer functions with proper search_path
CREATE OR REPLACE FUNCTION public.user_owns_opportunity(opportunity_id uuid, user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.opportunities 
    WHERE id = opportunity_id 
    AND (primary_owner_id = user_id OR created_by = user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_opportunity_split(opportunity_id uuid, user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.opportunity_splits 
    WHERE opportunity_splits.opportunity_id = user_has_opportunity_split.opportunity_id 
    AND opportunity_splits.user_id = user_id
  );
$$;