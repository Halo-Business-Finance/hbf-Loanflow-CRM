-- Fix the actual extension in public schema issue
-- The issue is with pg_net extension, not pgcrypto

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move the pg_net extension from public to extensions schema
ALTER EXTENSION pg_net SET SCHEMA extensions;

-- Log the fix
INSERT INTO public.audit_logs (action, table_name, new_values, user_id)
VALUES (
  'extension_schema_fix_pg_net',
  'pg_net_extension',
  jsonb_build_object(
    'action', 'moved_pg_net_extension_to_extensions_schema',
    'from_schema', 'public',
    'to_schema', 'extensions',
    'extension_name', 'pg_net'
  ),
  auth.uid()
);