-- Enable pgcrypto extension for cryptographic functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify the extension is working
DO $$
BEGIN
  -- Test gen_random_bytes function
  PERFORM gen_random_bytes(32);
  RAISE NOTICE 'pgcrypto extension enabled successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to enable pgcrypto: %', SQLERRM;
END $$;