-- Enable pg_cron and pg_net extensions for persistent AI bots
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create AI security bots configuration table
CREATE TABLE IF NOT EXISTS ai_security_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name TEXT NOT NULL UNIQUE,
  bot_type TEXT NOT NULL, -- 'threat_detection', 'behavior_analysis', 'network_monitor', 'data_protection'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'maintenance'
  sensitivity_level TEXT NOT NULL DEFAULT 'high', -- 'low', 'medium', 'high', 'critical'
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
  configuration JSONB NOT NULL DEFAULT '{}',
  performance_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create AI bot alerts table for high-priority findings
CREATE TABLE IF NOT EXISTS ai_bot_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES ai_security_bots(id),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical', 'emergency'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  threat_indicators JSONB DEFAULT '{}',
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0.0, -- 0.00 to 100.00
  auto_response_taken BOOLEAN DEFAULT false,
  requires_human_review BOOLEAN DEFAULT false,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID DEFAULT NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create AI bot activity log
CREATE TABLE IF NOT EXISTS ai_bot_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES ai_security_bots(id),
  activity_type TEXT NOT NULL, -- 'scan', 'alert', 'analysis', 'response'
  details JSONB NOT NULL DEFAULT '{}',
  execution_time_ms INTEGER DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'completed', -- 'running', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert initial AI security bots with high alert configuration
INSERT INTO ai_security_bots (bot_name, bot_type, sensitivity_level, configuration) VALUES
('ThreatHunter-Alpha', 'threat_detection', 'critical', '{
  "scan_interval_seconds": 30,
  "threat_thresholds": {
    "failed_login_threshold": 3,
    "geo_anomaly_threshold": 1,
    "data_access_anomaly": 2,
    "privilege_escalation": 1
  },
  "auto_response": {
    "block_suspicious_ips": true,
    "lock_compromised_accounts": true,
    "alert_admin_immediately": true
  },
  "ai_analysis": {
    "pattern_recognition": true,
    "behavioral_scoring": true,
    "predictive_threat_modeling": true
  }
}'),
('BehaviorWatch-Beta', 'behavior_analysis', 'high', '{
  "analysis_window_minutes": 5,
  "anomaly_detection": {
    "unusual_login_times": true,
    "location_jumps": true,
    "rapid_data_access": true,
    "privilege_usage_patterns": true
  },
  "learning_mode": true,
  "baseline_update_frequency": "hourly"
}'),
('NetworkGuard-Gamma', 'network_monitor', 'high', '{
  "monitor_endpoints": [
    "/api/auth",
    "/api/data",
    "/api/admin"
  ],
  "rate_limits": {
    "requests_per_minute": 60,
    "auth_attempts_per_hour": 10
  },
  "ddos_detection": true,
  "port_scan_detection": true
}'),
('DataProtector-Delta', 'data_protection', 'critical', '{
  "monitor_tables": [
    "contact_entities",
    "contact_encrypted_fields",
    "leads",
    "clients"
  ],
  "sensitive_field_access": true,
  "bulk_operation_detection": true,
  "encryption_validation": true,
  "data_exfiltration_patterns": true
}');

-- Enable RLS on AI bot tables
ALTER TABLE ai_security_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_bot_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_bot_activity ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for AI bot tables
CREATE POLICY "Admins can manage AI security bots" ON ai_security_bots
  FOR ALL USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "Admins can view AI bot alerts" ON ai_bot_alerts
  FOR SELECT USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "System can create AI bot alerts" ON ai_bot_alerts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update AI bot alerts" ON ai_bot_alerts
  FOR UPDATE USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "Admins can view AI bot activity" ON ai_bot_activity
  FOR SELECT USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

CREATE POLICY "System can log AI bot activity" ON ai_bot_activity
  FOR INSERT WITH CHECK (true);

-- Create functions for AI bot management
CREATE OR REPLACE FUNCTION update_ai_bot_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.last_activity = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_bot_activity_trigger
  BEFORE UPDATE ON ai_security_bots
  FOR EACH ROW EXECUTE FUNCTION update_ai_bot_activity();

-- Create emergency shutdown function for AI bots
CREATE OR REPLACE FUNCTION emergency_shutdown_ai_bots(p_reason TEXT DEFAULT 'Emergency shutdown triggered')
RETURNS JSONB AS $$
BEGIN
  -- Deactivate all bots
  UPDATE ai_security_bots 
  SET status = 'inactive', 
      updated_at = now(),
      configuration = configuration || jsonb_build_object('emergency_shutdown', true, 'shutdown_reason', p_reason);
  
  -- Log emergency shutdown
  INSERT INTO emergency_events (threat_type, severity, trigger_source, event_data, auto_shutdown)
  VALUES ('ai_bot_shutdown', 'critical', 'system', 
          jsonb_build_object('reason', p_reason, 'timestamp', now()), true);
  
  RETURN jsonb_build_object('success', true, 'message', 'All AI security bots have been shut down');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;