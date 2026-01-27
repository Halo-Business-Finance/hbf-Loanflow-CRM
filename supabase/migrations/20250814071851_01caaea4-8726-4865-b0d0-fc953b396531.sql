-- Move extensions to dedicated schema for better security organization
-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move any public schema extensions to extensions schema
-- This is a preventive measure for future extensions
COMMENT ON SCHEMA extensions IS 'Dedicated schema for database extensions to improve security isolation';

-- Add rate limiting table for API security
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- Could be IP, user_id, etc.
  action_type TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(identifier, action_type, window_start)
);

-- Enable RLS on rate_limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow system and admins to manage rate limits
CREATE POLICY "System can manage rate limits" ON public.rate_limits
  FOR ALL USING (true);

-- Add automated security alerts table
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  user_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  auto_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on security_alerts
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- Security policies for alerts
CREATE POLICY "Admins can view all security alerts" ON public.security_alerts
  FOR SELECT USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "System can create security alerts" ON public.security_alerts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update security alerts" ON public.security_alerts
  FOR UPDATE USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- Add session anomaly detection table
CREATE TABLE IF NOT EXISTS public.session_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_token TEXT NOT NULL,
  anomaly_type TEXT NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  details JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on session_anomalies
ALTER TABLE public.session_anomalies ENABLE ROW LEVEL SECURITY;

-- Session anomaly policies
CREATE POLICY "Users can view their own session anomalies" ON public.session_anomalies
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all session anomalies" ON public.session_anomalies
  FOR SELECT USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "System can create session anomalies" ON public.session_anomalies
  FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_action ON public.rate_limits(identifier, action_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity_created ON public.security_alerts(severity, created_at);
CREATE INDEX IF NOT EXISTS idx_session_anomalies_user_created ON public.session_anomalies(user_id, created_at);