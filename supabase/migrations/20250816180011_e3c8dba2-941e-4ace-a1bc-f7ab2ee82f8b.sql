-- Create additional borrowers table
CREATE TABLE public.additional_borrowers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_entity_id UUID NOT NULL REFERENCES public.contact_entities(id) ON DELETE CASCADE,
  borrower_order INTEGER NOT NULL DEFAULT 1,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.additional_borrowers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for additional borrowers
CREATE POLICY "Users can view their additional borrowers" 
ON public.additional_borrowers 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.leads l 
    WHERE l.id = additional_borrowers.lead_id 
    AND l.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create additional borrowers for their leads" 
ON public.additional_borrowers 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads l 
    WHERE l.id = additional_borrowers.lead_id 
    AND l.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their additional borrowers" 
ON public.additional_borrowers 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.leads l 
    WHERE l.id = additional_borrowers.lead_id 
    AND l.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their additional borrowers" 
ON public.additional_borrowers 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.leads l 
    WHERE l.id = additional_borrowers.lead_id 
    AND l.user_id = auth.uid()
  )
);

-- Admin policies
CREATE POLICY "Admins can manage all additional borrowers" 
ON public.additional_borrowers 
FOR ALL 
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- Add trigger for updated_at
CREATE TRIGGER update_additional_borrowers_updated_at
  BEFORE UPDATE ON public.additional_borrowers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();