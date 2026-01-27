-- Fix service_providers public exposure by requiring authentication for all access

-- Drop the problematic policy that allows public access to active providers
DROP POLICY IF EXISTS "Users can view active service providers" ON public.service_providers;

-- The "Authenticated users can view service providers" policy already requires auth.uid() IS NOT NULL
-- Keep it for authenticated user access

-- Add comment documenting the security model
COMMENT ON TABLE public.service_providers IS 'Service providers (title companies, escrow services) with RLS requiring authentication. All access requires valid auth.uid().';
