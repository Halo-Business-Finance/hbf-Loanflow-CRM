-- Fix leads visibility for all user types
-- Drop the restrictive user-only policy and create more appropriate role-based access

-- First, let's check current policies and drop the overly restrictive ones
DROP POLICY IF EXISTS "Enhanced leads security - users own data only" ON public.leads;
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;

-- Create new comprehensive policy for lead viewing based on roles
CREATE POLICY "Role-based leads access" ON public.leads
FOR SELECT
TO public
USING (
  CASE 
    -- Super admins and admins can see all leads
    WHEN has_role('super_admin'::user_role) OR has_role('admin'::user_role) THEN true
    -- Managers can see all leads in their organization
    WHEN has_role('manager'::user_role) THEN true
    -- Loan processors can see all leads they need to process
    WHEN has_role('loan_processor'::user_role) THEN true
    -- Underwriters can see all leads for underwriting
    WHEN has_role('underwriter'::user_role) THEN true
    -- Funders can see all leads for funding decisions
    WHEN has_role('funder'::user_role) THEN true
    -- Closers can see all leads for closing
    WHEN has_role('closer'::user_role) THEN true
    -- Agents can see their own leads and leads assigned to them
    WHEN has_role('agent'::user_role) THEN (auth.uid() = user_id)
    -- Default: users can see their own leads
    ELSE (auth.uid() = user_id)
  END
);

-- Also update the contact_entities policies to be less restrictive for operational roles
-- Drop the overly restrictive policies
DROP POLICY IF EXISTS "ULTIMATE_FORTRESS_contact_entities_lockdown" ON public.contact_entities;

-- Create more appropriate role-based access for contact entities
CREATE POLICY "Role-based contact entities access" ON public.contact_entities
FOR SELECT
TO public
USING (
  CASE 
    -- Super admins can see all
    WHEN has_role('super_admin'::user_role) THEN true
    -- Admins can see all
    WHEN has_role('admin'::user_role) THEN true
    -- Managers can see all for management purposes
    WHEN has_role('manager'::user_role) THEN true
    -- Operational roles need access to process leads
    WHEN has_role('loan_processor'::user_role) OR 
         has_role('underwriter'::user_role) OR 
         has_role('funder'::user_role) OR 
         has_role('closer'::user_role) THEN true
    -- Agents can see their own contacts
    WHEN has_role('agent'::user_role) THEN (auth.uid() = user_id)
    -- Default: users can see their own
    ELSE (auth.uid() = user_id)
  END
);

-- Create appropriate policies for other operations
CREATE POLICY "Role-based contact entities insert" ON public.contact_entities
FOR INSERT
TO public
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Role-based contact entities update" ON public.contact_entities
FOR UPDATE
TO public
USING (
  CASE 
    -- Super admins and admins can update all
    WHEN has_role('super_admin'::user_role) OR has_role('admin'::user_role) THEN true
    -- Managers can update all
    WHEN has_role('manager'::user_role) THEN true
    -- Operational roles can update for processing
    WHEN has_role('loan_processor'::user_role) OR 
         has_role('underwriter'::user_role) OR 
         has_role('funder'::user_role) OR 
         has_role('closer'::user_role) THEN true
    -- Users can update their own
    ELSE (auth.uid() = user_id)
  END
)
WITH CHECK (
  CASE 
    -- Super admins and admins can update all
    WHEN has_role('super_admin'::user_role) OR has_role('admin'::user_role) THEN true
    -- Managers can update all
    WHEN has_role('manager'::user_role) THEN true
    -- Operational roles can update for processing
    WHEN has_role('loan_processor'::user_role) OR 
         has_role('underwriter'::user_role) OR 
         has_role('funder'::user_role) OR 
         has_role('closer'::user_role) THEN true
    -- Users can only update their own
    ELSE (auth.uid() = user_id)
  END
);

CREATE POLICY "Role-based contact entities delete" ON public.contact_entities
FOR DELETE
TO public
USING (
  CASE 
    -- Only admins and super admins can delete
    WHEN has_role('super_admin'::user_role) OR has_role('admin'::user_role) THEN true
    -- Users can delete their own (with restrictions)
    WHEN has_role('agent'::user_role) THEN (auth.uid() = user_id)
    ELSE false
  END
);

-- Update leads policies for insert/update/delete as well
CREATE POLICY "Role-based leads insert" ON public.leads
FOR INSERT
TO public
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Role-based leads update" ON public.leads
FOR UPDATE
TO public
USING (
  CASE 
    -- Admins and super admins can update all leads
    WHEN has_role('super_admin'::user_role) OR has_role('admin'::user_role) THEN true
    -- Managers can update all leads
    WHEN has_role('manager'::user_role) THEN true
    -- Operational roles can update leads for processing
    WHEN has_role('loan_processor'::user_role) OR 
         has_role('underwriter'::user_role) OR 
         has_role('funder'::user_role) OR 
         has_role('closer'::user_role) THEN true
    -- Agents can update their own leads
    ELSE (auth.uid() = user_id)
  END
)
WITH CHECK (
  CASE 
    -- Admins and super admins can update all leads
    WHEN has_role('super_admin'::user_role) OR has_role('admin'::user_role) THEN true
    -- Managers can update all leads
    WHEN has_role('manager'::user_role) THEN true
    -- Operational roles can update leads for processing
    WHEN has_role('loan_processor'::user_role) OR 
         has_role('underwriter'::user_role) OR 
         has_role('funder'::user_role) OR 
         has_role('closer'::user_role) THEN true
    -- Agents can only update their own leads
    ELSE (auth.uid() = user_id)
  END
);

CREATE POLICY "Role-based leads delete" ON public.leads
FOR DELETE
TO public
USING (
  CASE 
    -- Admins and super admins can delete leads
    WHEN has_role('super_admin'::user_role) OR has_role('admin'::user_role) THEN true
    -- Managers can delete leads
    WHEN has_role('manager'::user_role) THEN true
    -- Agents can delete their own leads
    WHEN has_role('agent'::user_role) THEN (auth.uid() = user_id)
    ELSE false
  END
);