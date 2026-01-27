-- Add performance indexes for frequently queried columns (safe version)

-- Contact entities indexes
CREATE INDEX IF NOT EXISTS idx_contact_entities_user_id ON public.contact_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_entities_stage ON public.contact_entities(stage);
CREATE INDEX IF NOT EXISTS idx_contact_entities_priority ON public.contact_entities(priority);
CREATE INDEX IF NOT EXISTS idx_contact_entities_created_at ON public.contact_entities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_entities_email ON public.contact_entities(email);

-- Security events indexes
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON public.security_events(event_type);

-- Active sessions indexes
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON public.active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires_at ON public.active_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_active_sessions_is_active ON public.active_sessions(is_active) WHERE is_active = true;

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);

-- User roles indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Clients indexes
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients(created_at DESC);

-- Cases indexes
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_client_id ON public.cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON public.cases(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contact_entities_user_stage ON public.contact_entities(user_id, stage);
CREATE INDEX IF NOT EXISTS idx_security_events_user_severity ON public.security_events(user_id, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_user_status ON public.clients(user_id, status);

COMMENT ON INDEX idx_contact_entities_user_id IS 'Performance index for user contact lookups';
COMMENT ON INDEX idx_security_events_created_at IS 'Performance index for recent security events';
COMMENT ON INDEX idx_active_sessions_is_active IS 'Partial index for active session queries';