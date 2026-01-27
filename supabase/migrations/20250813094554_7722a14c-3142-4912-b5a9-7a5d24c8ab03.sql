-- 1) Key management: add key material and helper, and update encrypt/decrypt
-- Ensure key material column exists
ALTER TABLE public.encryption_keys
ADD COLUMN IF NOT EXISTS key_material text;

-- Helper to fetch the active encryption key material
CREATE OR REPLACE FUNCTION public.get_active_encryption_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  k text;
BEGIN
  SELECT key_material
  INTO k
  FROM public.encryption_keys
  WHERE is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY last_rotated DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF k IS NULL THEN
    RAISE EXCEPTION 'No active encryption key configured';
  END IF;

  RETURN k;
END;
$$;

-- Replace encrypt_token to use active key material
CREATE OR REPLACE FUNCTION public.encrypt_token(p_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  key_material text;
  cipher bytea;
BEGIN
  key_material := public.get_active_encryption_key();
  cipher := encrypt(p_token::bytea, key_material::bytea, 'aes');
  RETURN encode(cipher, 'base64');
END;
$$;

-- Replace decrypt_token to try all keys (active first), for rotation/back-compat
CREATE OR REPLACE FUNCTION public.decrypt_token(p_encrypted_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  rec RECORD;
  decrypted text;
BEGIN
  -- Try active keys first, then inactive ones (most recent first)
  FOR rec IN (
    SELECT key_material
    FROM public.encryption_keys
    WHERE key_material IS NOT NULL
    ORDER BY is_active DESC, last_rotated DESC NULLS LAST, created_at DESC
  ) LOOP
    BEGIN
      decrypted := convert_from(
        decrypt(decode(p_encrypted_token, 'base64'), rec.key_material::bytea, 'aes'),
        'UTF8'
      );
      RETURN decrypted;
    EXCEPTION WHEN OTHERS THEN
      -- Try next key
      CONTINUE;
    END;
  END LOOP;

  RETURN NULL;
END;
$$;

-- Seed an active key if none exists (generate securely on DB side)
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT COUNT(*) INTO cnt FROM public.encryption_keys WHERE is_active = true;
  IF cnt = 0 THEN
    INSERT INTO public.encryption_keys (id, key_name, key_purpose, algorithm, is_active, key_material)
    VALUES (
      gen_random_uuid(),
      'default',
      'token_encryption',
      'AES-256-GCM',
      true,
      encode(gen_random_bytes(32), 'base64')
    );
  END IF;
END $$;

-- 2) RLS hardening: api_request_analytics
-- Remove overly permissive policy and keep admin-only reads
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='api_request_analytics' 
      AND policyname='System can manage API analytics'
  ) THEN
    EXECUTE 'DROP POLICY "System can manage API analytics" ON public.api_request_analytics';
  END IF;
END $$;

-- Ensure RLS is enabled (no-op if already)
ALTER TABLE public.api_request_analytics ENABLE ROW LEVEL SECURITY;

-- Optional: explicitly block client writes by not adding INSERT/UPDATE/DELETE policies
-- Admin SELECT policy assumed to already exist per current schema; if not, create it safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='api_request_analytics' 
      AND policyname='Admins can view API analytics'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Admins can view API analytics"
      ON public.api_request_analytics
      FOR SELECT
      USING (has_role('admin'::user_role));
    $$;
  END IF;
END $$;

-- 3) RLS hardening: device_fingerprints
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='device_fingerprints' 
      AND policyname='System can manage device fingerprints'
  ) THEN
    EXECUTE 'DROP POLICY "System can manage device fingerprints" ON public.device_fingerprints';
  END IF;
END $$;

ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

-- Users can insert their own device fingerprints
CREATE POLICY IF NOT EXISTS "Users can insert their device fingerprints"
ON public.device_fingerprints
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own device fingerprints
CREATE POLICY IF NOT EXISTS "Users can update their device fingerprints"
ON public.device_fingerprints
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can view their own device fingerprints or admins can view all
CREATE POLICY IF NOT EXISTS "Users/Admins can view device fingerprints"
ON public.device_fingerprints
FOR SELECT
USING ((auth.uid() = user_id) OR has_role('admin'::user_role));

-- Only admins can delete device fingerprints
CREATE POLICY IF NOT EXISTS "Admins can delete device fingerprints"
ON public.device_fingerprints
FOR DELETE
USING (has_role('admin'::user_role));

-- 4) Harden threat_incidents: remove broad INSERT policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='threat_incidents' 
      AND policyname='System can insert threat incidents'
  ) THEN
    EXECUTE 'DROP POLICY "System can insert threat incidents" ON public.threat_incidents';
  END IF;
END $$;

-- Keep RLS enabled and admin policies created previously
ALTER TABLE public.threat_incidents ENABLE ROW LEVEL SECURITY;