-- Advanced Security Enhancements - Fixed Migration

-- Create table for tracking security patterns and anomalies
CREATE TABLE IF NOT EXISTS public.security_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  pattern_data JSONB NOT NULL DEFAULT '{}',
  severity TEXT NOT NULL DEFAULT 'medium',
  confidence_score NUMERIC(3,2) NOT NULL DEFAULT 0.5,
  first_detected TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_detected TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_mitigated BOOLEAN NOT NULL DEFAULT false,
  mitigation_actions JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on security_patterns
ALTER TABLE public.security_patterns ENABLE ROW LEVEL SECURITY;

-- Create policies for security_patterns
CREATE POLICY "Admins can manage security patterns" ON public.security_patterns
FOR ALL USING (has_role('admin'::user_role));

CREATE POLICY "System can insert security patterns" ON public.security_patterns
FOR INSERT WITH CHECK (true);

-- Create table for IP reputation tracking
CREATE TABLE IF NOT EXISTS public.ip_reputation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET NOT NULL UNIQUE,
  reputation_score INTEGER NOT NULL DEFAULT 50,
  threat_categories TEXT[] DEFAULT '{}',
  country_code TEXT,
  is_vpn BOOLEAN DEFAULT false,
  is_tor BOOLEAN DEFAULT false,
  is_proxy BOOLEAN DEFAULT false,
  risk_level TEXT NOT NULL DEFAULT 'low',
  first_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  reputation_sources JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on ip_reputation
ALTER TABLE public.ip_reputation ENABLE ROW LEVEL SECURITY;

-- Create policies for ip_reputation
CREATE POLICY "Admins can manage IP reputation" ON public.ip_reputation
FOR ALL USING (has_role('admin'::user_role));

CREATE POLICY "System can update IP reputation" ON public.ip_reputation
FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update IP reputation records" ON public.ip_reputation
FOR UPDATE USING (true);

-- Create table for behavioral anomaly detection
CREATE TABLE IF NOT EXISTS public.user_behavior_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pattern_type TEXT NOT NULL,
  baseline_metrics JSONB NOT NULL DEFAULT '{}',
  current_metrics JSONB NOT NULL DEFAULT '{}',
  anomaly_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  deviation_factors JSONB DEFAULT '[]',
  is_anomalous BOOLEAN NOT NULL DEFAULT false,
  learning_phase BOOLEAN NOT NULL DEFAULT true,
  sample_size INTEGER NOT NULL DEFAULT 0,
  last_analysis TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_behavior_patterns
ALTER TABLE public.user_behavior_patterns ENABLE ROW LEVEL SECURITY;

-- Create policies for user_behavior_patterns
CREATE POLICY "Users can view their behavior patterns" ON public.user_behavior_patterns
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage behavior patterns" ON public.user_behavior_patterns
FOR ALL USING (has_role('admin'::user_role));

CREATE POLICY "System can manage behavior patterns" ON public.user_behavior_patterns
FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_security_patterns_type_active 
  ON public.security_patterns(pattern_type, is_active);

CREATE INDEX IF NOT EXISTS idx_ip_reputation_address 
  ON public.ip_reputation(ip_address);

CREATE INDEX IF NOT EXISTS idx_user_behavior_patterns_user_type 
  ON public.user_behavior_patterns(user_id, pattern_type);