
-- Marketing Automations table for drip sequences and workflow automation
CREATE TABLE public.marketing_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  automation_type TEXT NOT NULL DEFAULT 'drip_sequence',
  status TEXT NOT NULL DEFAULT 'draft',
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  trigger_conditions JSONB DEFAULT '{}',
  steps JSONB DEFAULT '[]',
  target_audience JSONB DEFAULT '{}',
  performance_metrics JSONB DEFAULT '{}',
  enrolled_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT false,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_automations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view automations"
  ON public.marketing_automations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert automations"
  ON public.marketing_automations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own automations"
  ON public.marketing_automations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete automations"
  ON public.marketing_automations FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
