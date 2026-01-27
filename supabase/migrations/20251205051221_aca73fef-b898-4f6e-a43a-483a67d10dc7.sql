-- Create table for document scan results (malware scanning cache)
CREATE TABLE IF NOT EXISTS public.document_scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_hash TEXT NOT NULL,
  file_name TEXT,
  file_size BIGINT,
  document_id UUID REFERENCES public.lead_documents(id) ON DELETE SET NULL,
  is_safe BOOLEAN NOT NULL DEFAULT true,
  scan_id TEXT,
  threats_found TEXT[] DEFAULT '{}',
  confidence INTEGER DEFAULT 0,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on file_hash for quick lookups
CREATE INDEX idx_document_scan_results_file_hash ON public.document_scan_results(file_hash);
CREATE INDEX idx_document_scan_results_scanned_at ON public.document_scan_results(scanned_at);

-- Enable RLS
ALTER TABLE public.document_scan_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins and the user who scanned can view results
CREATE POLICY "Users can view their own scan results"
  ON public.document_scan_results
  FOR SELECT
  USING (auth.uid() = scanned_by);

CREATE POLICY "Admins can view all scan results"
  ON public.document_scan_results
  FOR SELECT
  USING (public.has_role('admin'::public.user_role) OR public.has_role('super_admin'::public.user_role));

CREATE POLICY "Service role can insert scan results"
  ON public.document_scan_results
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can delete scan results"
  ON public.document_scan_results
  FOR DELETE
  USING (public.has_role('admin'::public.user_role) OR public.has_role('super_admin'::public.user_role));

-- Add comment for documentation
COMMENT ON TABLE public.document_scan_results IS 'Caches malware scan results for uploaded documents to avoid redundant API calls';