-- Create saved_reports table for storing report definitions
CREATE TABLE public.saved_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL DEFAULT 'custom',
  data_source TEXT NOT NULL, -- e.g., 'leads', 'clients', 'pipeline', 'commissions'
  selected_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  filters JSONB DEFAULT '[]'::jsonb,
  sort_by TEXT,
  sort_order TEXT DEFAULT 'asc',
  group_by TEXT,
  chart_type TEXT, -- 'bar', 'line', 'pie', 'table', 'area'
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create report_schedules table for scheduled delivery
CREATE TABLE public.report_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.saved_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  schedule_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  day_of_week INTEGER, -- 0-6 for weekly
  day_of_month INTEGER, -- 1-31 for monthly
  time_of_day TIME NOT NULL DEFAULT '08:00:00',
  timezone TEXT DEFAULT 'America/New_York',
  delivery_method TEXT NOT NULL DEFAULT 'email', -- 'email', 'slack', 'webhook'
  delivery_config JSONB DEFAULT '{}'::jsonb, -- email addresses, slack channel, etc.
  export_format TEXT DEFAULT 'pdf', -- 'pdf', 'csv', 'xlsx'
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,
  send_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create report_subscriptions for dashboard subscriptions
CREATE TABLE public.report_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  report_id UUID NOT NULL REFERENCES public.saved_reports(id) ON DELETE CASCADE,
  notification_enabled BOOLEAN DEFAULT true,
  email_on_change BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create report_execution_logs for tracking
CREATE TABLE public.report_execution_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.saved_reports(id) ON DELETE CASCADE,
  user_id UUID,
  execution_type TEXT NOT NULL, -- 'manual', 'scheduled', 'subscription'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  row_count INTEGER,
  execution_time_ms INTEGER,
  error_message TEXT,
  export_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saved_reports
CREATE POLICY "Users can view own and public reports" ON public.saved_reports
  FOR SELECT USING (user_id = auth.uid() OR is_public = true OR public.is_global_admin());

CREATE POLICY "Users can create own reports" ON public.saved_reports
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own reports" ON public.saved_reports
  FOR UPDATE USING (user_id = auth.uid() OR public.is_global_admin());

CREATE POLICY "Users can delete own reports" ON public.saved_reports
  FOR DELETE USING (user_id = auth.uid() OR public.is_global_admin());

-- RLS Policies for report_schedules
CREATE POLICY "Users can view own schedules" ON public.report_schedules
  FOR SELECT USING (user_id = auth.uid() OR public.is_global_admin());

CREATE POLICY "Users can create own schedules" ON public.report_schedules
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own schedules" ON public.report_schedules
  FOR UPDATE USING (user_id = auth.uid() OR public.is_global_admin());

CREATE POLICY "Users can delete own schedules" ON public.report_schedules
  FOR DELETE USING (user_id = auth.uid() OR public.is_global_admin());

-- RLS Policies for report_subscriptions
CREATE POLICY "Users can manage own subscriptions" ON public.report_subscriptions
  FOR ALL USING (user_id = auth.uid());

-- RLS Policies for report_execution_logs
CREATE POLICY "Users can view own execution logs" ON public.report_execution_logs
  FOR SELECT USING (user_id = auth.uid() OR public.is_global_admin());

CREATE POLICY "Users can create execution logs" ON public.report_execution_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Create updated_at trigger
CREATE TRIGGER update_saved_reports_updated_at
  BEFORE UPDATE ON public.saved_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_report_schedules_updated_at
  BEFORE UPDATE ON public.report_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();