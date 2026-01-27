-- Create service_providers table for title and escrow companies
CREATE TABLE IF NOT EXISTS public.service_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('title', 'escrow', 'both')),
  
  -- Basic contact information
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  website TEXT,
  logo_url TEXT,
  
  -- Service details
  service_areas JSONB DEFAULT '[]'::jsonb,
  license_numbers JSONB DEFAULT '{}'::jsonb,
  insurance_info JSONB DEFAULT '{}'::jsonb,
  certifications JSONB DEFAULT '[]'::jsonb,
  
  -- Performance metrics
  average_closing_days INTEGER,
  success_rate NUMERIC(5,2),
  total_closings INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Indexes
  CONSTRAINT service_providers_name_key UNIQUE (name, provider_type)
);

-- Create index for faster lookups
CREATE INDEX idx_service_providers_type ON public.service_providers(provider_type);
CREATE INDEX idx_service_providers_active ON public.service_providers(is_active);
CREATE INDEX idx_service_providers_service_areas ON public.service_providers USING GIN(service_areas);

-- Add trigger for updated_at
CREATE TRIGGER update_service_providers_updated_at
  BEFORE UPDATE ON public.service_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add title_company_id and escrow_company_id to contact_entities
ALTER TABLE public.contact_entities 
  ADD COLUMN IF NOT EXISTS title_company_id UUID REFERENCES public.service_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escrow_company_id UUID REFERENCES public.service_providers(id) ON DELETE SET NULL;

-- Create indexes for the foreign keys
CREATE INDEX IF NOT EXISTS idx_contact_entities_title_company 
  ON public.contact_entities(title_company_id);
CREATE INDEX IF NOT EXISTS idx_contact_entities_escrow_company 
  ON public.contact_entities(escrow_company_id);

-- Enable RLS
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_providers
CREATE POLICY "Users can view active service providers"
  ON public.service_providers FOR SELECT
  USING (is_active = true OR has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "Admins can manage service providers"
  ON public.service_providers FOR ALL
  USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role))
  WITH CHECK (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- Insert some sample service providers
INSERT INTO public.service_providers (name, provider_type, contact_person, phone, email, address, city, state, service_areas, average_closing_days, success_rate)
VALUES 
  ('First American Title', 'title', 'John Smith', '555-0101', 'john@firstam.com', '123 Title Ave', 'Los Angeles', 'CA', '["CA", "NV", "AZ"]'::jsonb, 30, 95.5),
  ('Chicago Title Company', 'title', 'Mary Johnson', '555-0102', 'mary@chicagotitle.com', '456 Main St', 'Chicago', 'IL', '["IL", "IN", "WI"]'::jsonb, 28, 96.2),
  ('Fidelity National Escrow', 'escrow', 'Robert Brown', '555-0201', 'robert@fidelity.com', '789 Escrow Blvd', 'Phoenix', 'AZ', '["AZ", "NM", "TX"]'::jsonb, 25, 97.1),
  ('Title & Escrow Services Inc', 'both', 'Sarah Davis', '555-0301', 'sarah@titleescrow.com', '321 Services Dr', 'Seattle', 'WA', '["WA", "OR", "ID"]'::jsonb, 27, 96.8)
ON CONFLICT (name, provider_type) DO NOTHING;