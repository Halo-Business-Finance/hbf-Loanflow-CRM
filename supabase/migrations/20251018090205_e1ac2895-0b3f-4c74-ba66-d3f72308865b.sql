-- Create loan_stages table for managing pipeline stages
CREATE TABLE IF NOT EXISTS public.loan_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  order_position INTEGER NOT NULL,
  probability INTEGER NOT NULL DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
  color TEXT NOT NULL DEFAULT 'blue',
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name),
  UNIQUE(order_position)
);

-- Enable RLS
ALTER TABLE public.loan_stages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view active loan stages"
  ON public.loan_stages
  FOR SELECT
  USING (is_active = true OR has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "Admins can manage loan stages"
  ON public.loan_stages
  FOR ALL
  USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role))
  WITH CHECK (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- Insert default SBA/Commercial loan stages
INSERT INTO public.loan_stages (name, order_position, probability, color, description) VALUES
  ('New Lead', 1, 5, 'gray', 'Initial contact or inquiry'),
  ('Qualification', 2, 15, 'blue', 'Qualifying the lead and gathering initial information'),
  ('Application', 3, 30, 'cyan', 'Formal loan application submitted'),
  ('Documentation', 4, 50, 'yellow', 'Collecting and reviewing required documents'),
  ('Underwriting', 5, 70, 'orange', 'Underwriter reviewing and analyzing the application'),
  ('Approval', 6, 85, 'green', 'Loan approved, preparing for closing'),
  ('Closing', 7, 95, 'purple', 'Final documents signed and closing process'),
  ('Funded', 8, 100, 'emerald', 'Loan successfully funded'),
  ('Closed Lost', 0, 0, 'red', 'Deal did not close')
ON CONFLICT (name) DO NOTHING;

-- Create index for faster queries
CREATE INDEX idx_loan_stages_active ON public.loan_stages(is_active);
CREATE INDEX idx_loan_stages_order ON public.loan_stages(order_position);