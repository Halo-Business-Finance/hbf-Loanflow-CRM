-- Enhanced Session Security Improvements - Fixed Version
-- Add role-based session timeouts and concurrent session limits

-- Create session timeout configuration by role
CREATE TABLE IF NOT EXISTS public.role_session_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.user_role NOT NULL UNIQUE,
  timeout_minutes INTEGER NOT NULL DEFAULT 480, -- 8 hours default
  max_concurrent_sessions INTEGER NOT NULL DEFAULT 3,
  require_2fa BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default configurations with existing roles only
INSERT INTO public.role_session_config (role, timeout_minutes, max_concurrent_sessions, require_2fa) VALUES
('super_admin', 120, 2, true),    -- 2 hours, max 2 sessions, 2FA required
('admin', 240, 3, true),          -- 4 hours, max 3 sessions, 2FA required
('manager', 360, 5, false),       -- 6 hours, max 5 sessions
('agent', 480, 3, false),         -- 8 hours, max 3 sessions
('closer', 480, 3, false),        -- 8 hours, max 3 sessions
('funder', 480, 3, false),        -- 8 hours, max 3 sessions
('underwriter', 480, 3, false);   -- 8 hours, max 3 sessions

-- Add session fingerprinting to active_sessions
ALTER TABLE public.active_sessions 
ADD COLUMN IF NOT EXISTS browser_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS screen_resolution TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT,
ADD COLUMN IF NOT EXISTS language TEXT,
ADD COLUMN IF NOT EXISTS session_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS concurrent_session_count INTEGER DEFAULT 1;

-- Create real-time security alerts table
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_user_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'resolved', 'false_positive')),
  assigned_to UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create automated response rules
CREATE TABLE IF NOT EXISTS public.automated_response_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL UNIQUE,
  trigger_conditions JSONB NOT NULL,
  response_actions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default automated response rules
INSERT INTO public.automated_response_rules (rule_name, trigger_conditions, response_actions, created_by) VALUES
('Multiple Failed Logins', 
 '{"event_type": "failed_login", "count": 5, "timeframe_minutes": 15}',
 '{"actions": ["lock_account", "send_alert", "log_security_event"], "severity": "high"}',
 NULL),
('Suspicious IP Login',
 '{"event_type": "login", "conditions": ["new_ip", "different_country"]}',
 '{"actions": ["require_2fa", "send_alert", "log_security_event"], "severity": "medium"}',
 NULL),
('High Risk Data Access',
 '{"event_type": "contact_data_access", "risk_score": {"gte": 70}}',
 '{"actions": ["send_alert", "log_security_event", "require_supervisor_approval"], "severity": "high"}',
 NULL);

-- Create compliance audit trail
CREATE TABLE IF NOT EXISTS public.compliance_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_type TEXT NOT NULL,
  regulation_type TEXT NOT NULL, -- SOX, PCI-DSS, GDPR, etc.
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  compliance_status TEXT DEFAULT 'compliant' CHECK (compliance_status IN ('compliant', 'violation', 'warning')),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.role_session_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automated_response_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_audit_trail ENABLE ROW LEVEL SECURITY;

-- RLS Policies for role_session_config
CREATE POLICY "Admins can manage role session config" ON public.role_session_config
  FOR ALL USING (public.has_role('admin', auth.uid()) OR public.has_role('super_admin', auth.uid()));

CREATE POLICY "Users can view their role config" ON public.role_session_config
  FOR SELECT USING (role = public.get_user_role(auth.uid()));

-- RLS Policies for security_alerts  
CREATE POLICY "Security admins can manage alerts" ON public.security_alerts
  FOR ALL USING (public.has_role('admin', auth.uid()) OR public.has_role('super_admin', auth.uid()));

CREATE POLICY "Users can view their own alerts" ON public.security_alerts
  FOR SELECT USING (affected_user_id = auth.uid());

-- RLS Policies for automated_response_rules
CREATE POLICY "Admins can manage response rules" ON public.automated_response_rules
  FOR ALL USING (public.has_role('admin', auth.uid()) OR public.has_role('super_admin', auth.uid()));

-- RLS Policies for compliance_audit_trail
CREATE POLICY "Compliance auditors can view all" ON public.compliance_audit_trail
  FOR SELECT USING (public.has_role('admin', auth.uid()) OR public.has_role('super_admin', auth.uid()));

CREATE POLICY "Users can view their own compliance records" ON public.compliance_audit_trail
  FOR SELECT USING (user_id = auth.uid());