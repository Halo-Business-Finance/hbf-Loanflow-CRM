-- Create lenders table
CREATE TABLE public.lenders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  lender_type TEXT NOT NULL DEFAULT 'bank', -- bank, credit_union, private_lender, etc.
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create lender_contacts table for BDOs and other bank employees
CREATE TABLE public.lender_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lender_id UUID NOT NULL REFERENCES public.lenders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  mobile_phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_bdo BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add lender reference to contact_entities for linking leads to lenders
ALTER TABLE public.contact_entities
ADD COLUMN IF NOT EXISTS lender_id UUID REFERENCES public.lenders(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE public.lenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lender_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lenders table
CREATE POLICY "Users can view all lenders"
ON public.lenders
FOR SELECT
USING (true);

CREATE POLICY "Users can create their own lenders"
ON public.lenders
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lenders"
ON public.lenders
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all lenders"
ON public.lenders
FOR UPDATE
USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::public.user_role[]));

CREATE POLICY "Users can delete their own lenders"
ON public.lenders
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete all lenders"
ON public.lenders
FOR DELETE
USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::public.user_role[]));

-- RLS Policies for lender_contacts table
CREATE POLICY "Users can view all lender contacts"
ON public.lender_contacts
FOR SELECT
USING (true);

CREATE POLICY "Users can create their own lender contacts"
ON public.lender_contacts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lender contacts"
ON public.lender_contacts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all lender contacts"
ON public.lender_contacts
FOR UPDATE
USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::public.user_role[]));

CREATE POLICY "Users can delete their own lender contacts"
ON public.lender_contacts
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete all lender contacts"
ON public.lender_contacts
FOR DELETE
USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::public.user_role[]));

-- Create indexes for better performance
CREATE INDEX idx_lenders_user_id ON public.lenders(user_id);
CREATE INDEX idx_lenders_is_active ON public.lenders(is_active);
CREATE INDEX idx_lender_contacts_lender_id ON public.lender_contacts(lender_id);
CREATE INDEX idx_lender_contacts_is_bdo ON public.lender_contacts(is_bdo);
CREATE INDEX idx_contact_entities_lender_id ON public.contact_entities(lender_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_lenders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_lender_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_lenders_updated_at
BEFORE UPDATE ON public.lenders
FOR EACH ROW
EXECUTE FUNCTION public.update_lenders_updated_at();

CREATE TRIGGER update_lender_contacts_updated_at
BEFORE UPDATE ON public.lender_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_lender_contacts_updated_at();