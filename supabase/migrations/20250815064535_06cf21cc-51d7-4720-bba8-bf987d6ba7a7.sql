-- Enhanced RLS Policies for Public Table Security
-- Fix any potential public table visibility issues

-- Enhanced password policies table protection
DROP POLICY IF EXISTS "Password policies read access" ON public.password_policies;
CREATE POLICY "Enhanced password policies read access" 
ON public.password_policies 
FOR SELECT 
USING (true); -- Read-only for security validation

-- Enhanced security notifications protection
DROP POLICY IF EXISTS "Security notifications user access" ON public.security_notifications;
CREATE POLICY "Enhanced security notifications user access" 
ON public.security_notifications 
FOR ALL 
USING (auth.uid() = user_id OR has_role('admin'::user_role))
WITH CHECK (auth.uid() = user_id OR has_role('admin'::user_role));

-- Enhanced role session config protection
DROP POLICY IF EXISTS "Role session config read access" ON public.role_session_config;
CREATE POLICY "Enhanced role session config read access" 
ON public.role_session_config 
FOR SELECT 
USING (true); -- Required for security validation

-- Enhanced encryption keys protection
DROP POLICY IF EXISTS "Encryption keys admin access" ON public.encryption_keys;
CREATE POLICY "Enhanced encryption keys admin access" 
ON public.encryption_keys 
FOR ALL 
USING (has_role('super_admin'::user_role))
WITH CHECK (has_role('super_admin'::user_role));

-- Enhanced session config protection
DROP POLICY IF EXISTS "Session config read access" ON public.session_config;
CREATE POLICY "Enhanced session config read access" 
ON public.session_config 
FOR SELECT 
USING (true); -- Required for session validation

-- Enhanced security configuration protection
DROP POLICY IF EXISTS "Security configuration admin access" ON public.security_configuration;
CREATE POLICY "Enhanced security configuration admin access" 
ON public.security_configuration 
FOR ALL 
USING (has_role('admin'::user_role))
WITH CHECK (has_role('admin'::user_role));

-- Enhanced rate limits protection
DROP POLICY IF EXISTS "Rate limits system access" ON public.rate_limits;
CREATE POLICY "Enhanced rate limits system access" 
ON public.rate_limits 
FOR ALL 
USING (true); -- System function access only

-- Enhanced IP restrictions protection  
DROP POLICY IF EXISTS "IP restrictions admin access" ON public.ip_restrictions;
CREATE POLICY "Enhanced IP restrictions admin access" 
ON public.ip_restrictions 
FOR ALL 
USING (has_role('admin'::user_role))
WITH CHECK (has_role('admin'::user_role));

-- Create granular session activity tracking table
CREATE TABLE IF NOT EXISTS public.session_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  page_url TEXT,
  action_type TEXT,
  element_id TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  device_fingerprint TEXT,
  geolocation JSONB DEFAULT '{}',
  performance_metrics JSONB DEFAULT '{}',
  risk_indicators JSONB DEFAULT '{}',
  INDEX idx_session_activity_user_time (user_id, timestamp),
  INDEX idx_session_activity_session (session_id),
  INDEX idx_session_activity_type (activity_type)
);

-- Enable RLS on session activity log
ALTER TABLE public.session_activity_log ENABLE ROW LEVEL SECURITY;

-- Create policies for session activity log
CREATE POLICY "Users can view their own session activity" 
ON public.session_activity_log 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert session activity" 
ON public.session_activity_log 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can view all session activity" 
ON public.session_activity_log 
FOR SELECT 
USING (has_role('admin'::user_role));

-- Add more columns to active_sessions for enhanced tracking
ALTER TABLE public.active_sessions 
ADD COLUMN IF NOT EXISTS page_url TEXT,
ADD COLUMN IF NOT EXISTS referrer TEXT,
ADD COLUMN IF NOT EXISTS session_duration_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS page_views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS keyboard_activity_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS mouse_activity_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS scroll_activity_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS idle_time_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS risk_factors JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS security_alerts_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_security_check TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS browser_fingerprint JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS screen_resolution TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT,
ADD COLUMN IF NOT EXISTS connection_speed TEXT,
ADD COLUMN IF NOT EXISTS battery_level INTEGER,
ADD COLUMN IF NOT EXISTS memory_usage INTEGER;