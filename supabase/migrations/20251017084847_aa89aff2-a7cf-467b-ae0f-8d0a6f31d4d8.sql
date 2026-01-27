-- Create notes_history table to track all note entries
CREATE TABLE public.notes_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contact_entities(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL CHECK (note_type IN ('general', 'call')),
  content TEXT NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notes_history ENABLE ROW LEVEL SECURITY;

-- Users can view notes history for their own contacts
CREATE POLICY "Users can view their contact notes history"
ON public.notes_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contact_entities ce
    WHERE ce.id = notes_history.contact_id
    AND ce.user_id = auth.uid()
  )
);

-- Users can insert notes history for their own contacts
CREATE POLICY "Users can insert notes history for their contacts"
ON public.notes_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contact_entities ce
    WHERE ce.id = notes_history.contact_id
    AND ce.user_id = auth.uid()
  )
);

-- Admins can manage all notes history
CREATE POLICY "Admins can manage all notes history"
ON public.notes_history
FOR ALL
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- Create index for faster queries
CREATE INDEX idx_notes_history_contact_id ON public.notes_history(contact_id);
CREATE INDEX idx_notes_history_created_at ON public.notes_history(created_at DESC);

-- Add trigger to update updated_at
CREATE TRIGGER set_notes_history_updated_at
  BEFORE UPDATE ON public.notes_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();