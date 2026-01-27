-- SLA Management Tables
CREATE TABLE public.sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_type text NOT NULL DEFAULT 'lead',
  response_time_hours integer NOT NULL DEFAULT 24,
  resolution_time_hours integer NOT NULL DEFAULT 72,
  escalation_rules jsonb NOT NULL DEFAULT '[]',
  priority_multipliers jsonb NOT NULL DEFAULT '{"high": 0.5, "medium": 1, "low": 1.5}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sla_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid REFERENCES public.sla_policies(id) ON DELETE CASCADE NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  first_response_at timestamptz,
  resolved_at timestamptz,
  response_deadline timestamptz NOT NULL,
  resolution_deadline timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open',
  escalation_level integer NOT NULL DEFAULT 0,
  last_escalated_at timestamptz,
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- AI Lead Scoring Tables
CREATE TABLE public.ai_lead_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0,
  factors jsonb NOT NULL DEFAULT '[]',
  next_best_actions jsonb NOT NULL DEFAULT '[]',
  predicted_close_date date,
  predicted_value numeric,
  model_version text NOT NULL DEFAULT 'v1',
  scored_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Executive Dashboard Widgets
CREATE TABLE public.dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  widget_type text NOT NULL,
  title text NOT NULL,
  configuration jsonb NOT NULL DEFAULT '{}',
  position_x integer NOT NULL DEFAULT 0,
  position_y integer NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 4,
  height integer NOT NULL DEFAULT 3,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partner/Broker Portal Tables
CREATE TABLE public.partner_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  partner_type text NOT NULL DEFAULT 'broker',
  contact_email text NOT NULL,
  contact_phone text,
  commission_rate numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  api_key_hash text,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.partner_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.partner_organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  permissions jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.partner_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.partner_organizations(id) ON DELETE CASCADE NOT NULL,
  submitted_by uuid NOT NULL,
  borrower_name text NOT NULL,
  borrower_email text NOT NULL,
  borrower_phone text,
  loan_amount numeric NOT NULL,
  loan_type text NOT NULL,
  business_name text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  assigned_to uuid,
  converted_lead_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Multi-Entity Support Tables
CREATE TABLE public.business_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_type text NOT NULL DEFAULT 'branch',
  parent_entity_id uuid REFERENCES public.business_entities(id),
  settings jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.entity_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES public.business_entities(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, user_id)
);

-- Integration Hub Tables
CREATE TABLE public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_type text NOT NULL,
  name text NOT NULL,
  provider text NOT NULL,
  credentials_encrypted text,
  settings jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  last_sync_at timestamptz,
  error_message text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES public.integration_connections(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  status text NOT NULL,
  request_data jsonb,
  response_data jsonb,
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for SLA
CREATE POLICY "Users can view SLA policies" ON public.sla_policies FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage SLA policies" ON public.sla_policies FOR ALL USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "Users can view their SLA tracking" ON public.sla_tracking FOR SELECT USING (assigned_to = auth.uid() OR has_role('admin'::user_role) OR has_role('super_admin'::user_role) OR has_role('manager'::user_role));
CREATE POLICY "System can manage SLA tracking" ON public.sla_tracking FOR ALL USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- RLS Policies for AI Lead Scores
CREATE POLICY "Users can view lead scores" ON public.ai_lead_scores FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "System can manage lead scores" ON public.ai_lead_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update lead scores" ON public.ai_lead_scores FOR UPDATE USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- RLS Policies for Dashboard Widgets
CREATE POLICY "Users can manage their widgets" ON public.dashboard_widgets FOR ALL USING (user_id = auth.uid());

-- RLS Policies for Partner Portal
CREATE POLICY "Admins can manage partner organizations" ON public.partner_organizations FOR ALL USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));
CREATE POLICY "Partner users can view their organization" ON public.partner_organizations FOR SELECT USING (EXISTS (SELECT 1 FROM public.partner_users pu WHERE pu.organization_id = id AND pu.user_id = auth.uid()));

CREATE POLICY "Users can view their partner membership" ON public.partner_users FOR SELECT USING (user_id = auth.uid() OR has_role('admin'::user_role) OR has_role('super_admin'::user_role));
CREATE POLICY "Admins can manage partner users" ON public.partner_users FOR ALL USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "Partners can create submissions" ON public.partner_submissions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.partner_users pu WHERE pu.organization_id = organization_id AND pu.user_id = auth.uid()));
CREATE POLICY "Partners can view their submissions" ON public.partner_submissions FOR SELECT USING (submitted_by = auth.uid() OR assigned_to = auth.uid() OR has_role('admin'::user_role) OR has_role('super_admin'::user_role));
CREATE POLICY "Admins can manage submissions" ON public.partner_submissions FOR ALL USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- RLS Policies for Business Entities
CREATE POLICY "Users can view business entities" ON public.business_entities FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage business entities" ON public.business_entities FOR ALL USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "Users can view their entity memberships" ON public.entity_memberships FOR SELECT USING (user_id = auth.uid() OR has_role('admin'::user_role) OR has_role('super_admin'::user_role));
CREATE POLICY "Admins can manage entity memberships" ON public.entity_memberships FOR ALL USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- RLS Policies for Integrations
CREATE POLICY "Users can view integrations" ON public.integration_connections FOR SELECT USING (created_by = auth.uid() OR has_role('admin'::user_role) OR has_role('super_admin'::user_role));
CREATE POLICY "Admins can manage integrations" ON public.integration_connections FOR ALL USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "Users can view integration logs" ON public.integration_logs FOR SELECT USING (EXISTS (SELECT 1 FROM public.integration_connections ic WHERE ic.id = connection_id AND (ic.created_by = auth.uid() OR has_role('admin'::user_role) OR has_role('super_admin'::user_role))));
CREATE POLICY "System can insert integration logs" ON public.integration_logs FOR INSERT WITH CHECK (true);