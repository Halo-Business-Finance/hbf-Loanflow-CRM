-- Update all existing 'agent' roles to 'loan_originator' in user_roles table
UPDATE public.user_roles 
SET role = 'loan_originator' 
WHERE role = 'agent';

-- Log the migration for audit purposes
INSERT INTO public.security_events (event_type, severity, details)
VALUES (
  'role_migration_agent_to_loan_originator',
  'medium',
  jsonb_build_object(
    'migration_date', now(),
    'description', 'Migrated all agent roles to loan_originator',
    'affected_table', 'user_roles'
  )
);