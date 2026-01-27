-- Fix extension in public schema warning
-- Use ALTER EXTENSION to properly move pgcrypto from public to extensions schema

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move the pgcrypto extension from public to extensions schema
ALTER EXTENSION pgcrypto SET SCHEMA extensions;

-- Log the fix
INSERT INTO public.audit_logs (action, table_name, new_values, user_id)
VALUES (
  'extension_schema_fix',
  'pgcrypto_extension',
  jsonb_build_object(
    'action', 'moved_extension_to_extensions_schema',
    'from_schema', 'public',
    'to_schema', 'extensions',
    'extension_name', 'pgcrypto'
  ),
  auth.uid()
);