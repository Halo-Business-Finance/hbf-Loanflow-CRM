-- Fix pg_net extension in public schema
-- Since pg_net doesn't support SET SCHEMA, we need to drop and recreate it in extensions schema
-- This is safe because the http_request_queue is empty

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop the pg_net extension (queue is confirmed empty)
DROP EXTENSION pg_net;

-- Recreate pg_net extension in the extensions schema
CREATE EXTENSION pg_net WITH SCHEMA extensions;

-- Log the fix
INSERT INTO public.audit_logs (action, table_name, new_values, user_id)
VALUES (
  'extension_schema_fix_pg_net_recreate',
  'pg_net_extension',
  jsonb_build_object(
    'action', 'recreated_pg_net_extension_in_extensions_schema',
    'from_schema', 'public',
    'to_schema', 'extensions',
    'extension_name', 'pg_net',
    'method', 'drop_and_recreate'
  ),
  auth.uid()
);