-- Fix extension organization - move pgcrypto from public to extensions schema
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;