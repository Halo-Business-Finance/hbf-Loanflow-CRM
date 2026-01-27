-- 1) Ensure email token encryption trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relname = 'email_accounts' 
      AND t.tgname = 'trg_encrypt_email_account_tokens'
  ) THEN
    CREATE TRIGGER trg_encrypt_email_account_tokens
    BEFORE INSERT OR UPDATE ON public.email_accounts
    FOR EACH ROW EXECUTE FUNCTION public.encrypt_email_account_tokens();
  END IF;
END$$;

-- 2) Harden Storage policies for lead-documents by removing overly permissive ones
DROP POLICY IF EXISTS "Public read access for lead-documents" ON storage.objects;
DROP POLICY IF EXISTS "All authenticated users can view lead documents in storage" ON storage.objects;
DROP POLICY IF EXISTS "All authenticated users can upload lead documents to storage" ON storage.objects;
DROP POLICY IF EXISTS "All authenticated users can update lead documents in storage" ON storage.objects;
DROP POLICY IF EXISTS "All authenticated users can delete lead documents from storage" ON storage.objects;

-- Note: Least-privilege per-user policies already exist (multiple variants). We keep them, and only remove public/wide-open ones.