-- Create task_assignments table for cross-role collaboration
CREATE TABLE public.task_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL, -- 'review', 'approval', 'document_check', 'escalation'
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  assigned_to UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  related_entity_id UUID, -- ID of related lead/client/loan
  related_entity_type TEXT, -- 'contact_entity', 'client', 'loan'
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for task_assignments
CREATE POLICY "Users can view their assigned tasks"
  ON public.task_assignments
  FOR SELECT
  USING (auth.uid() = assigned_to OR auth.uid() = assigned_by);

CREATE POLICY "Users can create task assignments"
  ON public.task_assignments
  FOR INSERT
  WITH CHECK (auth.uid() = assigned_by);

CREATE POLICY "Users can update their assigned tasks"
  ON public.task_assignments
  FOR UPDATE
  USING (auth.uid() = assigned_to OR auth.uid() = assigned_by);

CREATE POLICY "Admins can manage all tasks"
  ON public.task_assignments
  FOR ALL
  USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- Create index for performance
CREATE INDEX idx_task_assignments_assigned_to ON public.task_assignments(assigned_to);
CREATE INDEX idx_task_assignments_status ON public.task_assignments(status);
CREATE INDEX idx_task_assignments_related_entity ON public.task_assignments(related_entity_id, related_entity_type);

-- Create escalations table
CREATE TABLE public.application_escalations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL, -- contact_entity_id
  escalated_from UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  escalated_to UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'high', -- 'high', 'urgent', 'critical'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'rejected'
  resolution TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.application_escalations ENABLE ROW LEVEL SECURITY;

-- Policies for escalations
CREATE POLICY "Users can view escalations they're involved in"
  ON public.application_escalations
  FOR SELECT
  USING (auth.uid() = escalated_from OR auth.uid() = escalated_to);

CREATE POLICY "Users can create escalations"
  ON public.application_escalations
  FOR INSERT
  WITH CHECK (auth.uid() = escalated_from);

CREATE POLICY "Users can update escalations they received"
  ON public.application_escalations
  FOR UPDATE
  USING (auth.uid() = escalated_to);

CREATE POLICY "Admins can manage all escalations"
  ON public.application_escalations
  FOR ALL
  USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- Create index for performance
CREATE INDEX idx_escalations_escalated_to ON public.application_escalations(escalated_to);
CREATE INDEX idx_escalations_status ON public.application_escalations(status);
CREATE INDEX idx_escalations_application ON public.application_escalations(application_id);