-- Create granular session activity tracking table for enhanced monitoring
CREATE TABLE IF NOT EXISTS public.session_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
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
  risk_indicators JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_activity_user_time ON public.session_activity_log (user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_session_activity_session ON public.session_activity_log (session_id);
CREATE INDEX IF NOT EXISTS idx_session_activity_type ON public.session_activity_log (activity_type);

-- Enable RLS on session activity log
ALTER TABLE public.session_activity_log ENABLE ROW LEVEL SECURITY;

-- Create policies for session activity log
DROP POLICY IF EXISTS "Users can view their own session activity" ON public.session_activity_log;
CREATE POLICY "Users can view their own session activity" 
ON public.session_activity_log 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert session activity" ON public.session_activity_log;
CREATE POLICY "System can insert session activity" 
ON public.session_activity_log 
FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all session activity" ON public.session_activity_log;
CREATE POLICY "Admins can view all session activity" 
ON public.session_activity_log 
FOR SELECT 
USING (has_role('admin'::user_role));

-- Add enhanced tracking columns to active_sessions
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
ADD COLUMN IF NOT EXISTS timezone TEXT;