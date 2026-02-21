/**
 * HBF API Route Mapping
 *
 * Maps CRM table names to hbf-api REST endpoints.
 * Each entry describes how to translate Supabase-style operations
 * (select, insert, update, delete) into REST calls.
 *
 * Response normalization:
 *   - `dataKey` — where to find the rows in the JSON response.
 *     'root' means the response is the array itself.
 *     A string like 'data' means response.data holds the rows.
 */

export interface RouteConfig {
  /** Base path on hbf-api, e.g. '/api/v1/leads' */
  basePath: string;
  /**
   * Where rows live in the JSON response.
   * 'root' = response IS the array. Otherwise response[dataKey].
   */
  dataKey: 'root' | string;
  /** Query-param names this route accepts for filtering on GET */
  filterParams?: string[];
  /** If true, GET /:id is supported */
  supportsGetById?: boolean;
  /** If true, DELETE /:id is supported */
  supportsDelete?: boolean;
}

/**
 * Maps CRM table names → hbf-api route config.
 *
 * Tables NOT listed here do not have dedicated hbf-api routes yet
 * and will return an informative error when accessed.
 */
export const ROUTE_MAP: Record<string, RouteConfig> = {
  // ── Existing hbf-api routes ────────────────────────────────
  leads: {
    basePath: '/api/v1/leads',
    dataKey: 'root',
    filterParams: ['status', 'source'],
    supportsGetById: true,
    supportsDelete: true,
  },
  contact_entities: {
    basePath: '/api/v1/borrowers',
    dataKey: 'root',
    filterParams: [],
    supportsGetById: true,
    supportsDelete: false,
  },
  borrowers: {
    basePath: '/api/v1/borrowers',
    dataKey: 'root',
    filterParams: [],
    supportsGetById: true,
    supportsDelete: false,
  },
  loan_applications: {
    basePath: '/api/v1/loan-applications',
    dataKey: 'root',
    filterParams: ['status', 'borrower_id'],
    supportsGetById: true,
    supportsDelete: false,
  },
  notifications: {
    basePath: '/api/v1/notifications',
    dataKey: 'root',
    filterParams: ['success', 'limit'],
    supportsGetById: false,
    supportsDelete: false,
  },
  audit_logs: {
    basePath: '/api/v1/audit-logs',
    dataKey: 'data',
    filterParams: ['method', 'path', 'actor', 'actor_type', 'status_min', 'status_max', 'since', 'until', 'limit', 'offset'],
    supportsGetById: false,
    supportsDelete: false,
  },

  // ── New routes (added via crud-factory) ────────────────────
  lenders: {
    basePath: '/api/v1/lenders',
    dataKey: 'root',
    filterParams: ['status', 'lender_type', 'user_id'],
    supportsGetById: true,
    supportsDelete: true,
  },
  clients: {
    basePath: '/api/v1/clients',
    dataKey: 'root',
    filterParams: ['status', 'user_id'],
    supportsGetById: true,
    supportsDelete: false,
  },
  service_providers: {
    basePath: '/api/v1/service-providers',
    dataKey: 'root',
    filterParams: ['status', 'provider_type', 'user_id'],
    supportsGetById: true,
    supportsDelete: true,
  },
  profiles: {
    basePath: '/api/v1/profiles',
    dataKey: 'root',
    filterParams: ['user_id', 'role', 'is_active'],
    supportsGetById: true,
    supportsDelete: false,
  },
  messages: {
    basePath: '/api/v1/messages',
    dataKey: 'root',
    filterParams: ['user_id', 'recipient_id', 'lead_id', 'is_read', 'message_type'],
    supportsGetById: true,
    supportsDelete: true,
  },
  tasks: {
    basePath: '/api/v1/tasks',
    dataKey: 'root',
    filterParams: ['user_id', 'assigned_to', 'status', 'priority', 'lead_id'],
    supportsGetById: true,
    supportsDelete: true,
  },
  lead_documents: {
    basePath: '/api/v1/lead-documents',
    dataKey: 'root',
    filterParams: ['lead_id', 'user_id', 'status', 'document_type'],
    supportsGetById: true,
    supportsDelete: true,
  },
  document_templates: {
    basePath: '/api/v1/document-templates',
    dataKey: 'root',
    filterParams: ['template_type', 'is_active', 'user_id'],
    supportsGetById: true,
    supportsDelete: true,
  },
  document_versions: {
    basePath: '/api/v1/document-versions',
    dataKey: 'root',
    filterParams: ['document_id', 'uploaded_by'],
    supportsGetById: true,
    supportsDelete: false,
  },
  email_accounts: {
    basePath: '/api/v1/email-accounts',
    dataKey: 'root',
    filterParams: ['user_id', 'is_active', 'provider'],
    supportsGetById: true,
    supportsDelete: true,
  },
  approval_requests: {
    basePath: '/api/v1/approval-requests',
    dataKey: 'root',
    filterParams: ['status', 'submitted_by', 'record_type'],
    supportsGetById: true,
    supportsDelete: false,
  },
  approval_steps: {
    basePath: '/api/v1/approval-steps',
    dataKey: 'root',
    filterParams: ['request_id', 'approver_id', 'status'],
    supportsGetById: true,
    supportsDelete: false,
  },
  sla_policies: {
    basePath: '/api/v1/sla-policies',
    dataKey: 'root',
    filterParams: ['entity_type', 'is_active'],
    supportsGetById: true,
    supportsDelete: true,
  },
  sla_tracking: {
    basePath: '/api/v1/sla-tracking',
    dataKey: 'root',
    filterParams: ['policy_id', 'entity_type', 'entity_id', 'status', 'assigned_to'],
    supportsGetById: true,
    supportsDelete: false,
  },
  lender_contacts: {
    basePath: '/api/v1/lender-contacts',
    dataKey: 'root',
    filterParams: ['lender_id', 'email', 'is_active'],
    supportsGetById: true,
    supportsDelete: true,
  },
  ai_lead_scores: {
    basePath: '/api/v1/ai-lead-scores',
    dataKey: 'root',
    filterParams: ['lead_id', 'score'],
    supportsGetById: true,
    supportsDelete: false,
  },
  partner_organizations: {
    basePath: '/api/v1/partner-organizations',
    dataKey: 'root',
    filterParams: ['status', 'partner_type'],
    supportsGetById: true,
    supportsDelete: true,
  },
  partner_submissions: {
    basePath: '/api/v1/partner-submissions',
    dataKey: 'root',
    filterParams: ['organization_id', 'status', 'submitted_by'],
    supportsGetById: true,
    supportsDelete: false,
  },
  security_events: {
    basePath: '/api/v1/security-events',
    dataKey: 'root',
    filterParams: ['event_type', 'severity', 'user_id'],
    supportsGetById: true,
    supportsDelete: false,
  },
  threat_incidents: {
    basePath: '/api/v1/security-pattern-alerts', // Mapping to security-pattern-alerts for now
    dataKey: 'root',
    filterParams: ['alert_type', 'severity', 'status'],
    supportsGetById: true,
    supportsDelete: false,
  },
  active_sessions: {
    basePath: '/api/v1/active-sessions',
    dataKey: 'root',
    filterParams: ['user_id', 'is_active', 'session_token'],
    supportsGetById: true,
    supportsDelete: true,
  },
  user_roles: {
    basePath: '/api/v1/user-roles',
    dataKey: 'root',
    filterParams: ['user_id', 'role', 'is_active'],
    supportsGetById: true,
    supportsDelete: true,
  },
  user_sessions: {
    basePath: '/api/v1/active-sessions', // Mapping to active-sessions
    dataKey: 'root',
    filterParams: ['user_id', 'is_active'],
    supportsGetById: true,
    supportsDelete: true,
  },
  user_messages: {
    basePath: '/api/v1/user-messages',
    dataKey: 'root',
    filterParams: ['sender_id', 'recipient_id', 'is_read'],
    supportsGetById: true,
    supportsDelete: true,
  },
  emergency_events: {
    basePath: '/api/v1/emergency-events',
    dataKey: 'root',
    filterParams: ['severity', 'threat_type', 'trigger_source'],
    supportsGetById: true,
    supportsDelete: false,
  },
  emergency_shutdown: {
    basePath: '/api/v1/emergency-shutdown',
    dataKey: 'root',
    filterParams: ['is_active', 'shutdown_level'],
    supportsGetById: true,
    supportsDelete: false,
  },
  report_execution_logs: {
    basePath: '/api/v1/report-execution-logs',
    dataKey: 'root',
    filterParams: ['report_id', 'user_id', 'status'],
    supportsGetById: true,
    supportsDelete: false,
  },
  saved_reports: {
    basePath: '/api/v1/report-execution-logs', // Should be separate, but using existing pattern
    dataKey: 'root',
    filterParams: ['user_id', 'is_public', 'report_type'],
    supportsGetById: true,
    supportsDelete: true,
  },
  business_entities: {
    basePath: '/api/v1/business-entities',
    dataKey: 'root',
    filterParams: ['entity_type', 'parent_entity_id', 'is_active'],
    supportsGetById: true,
    supportsDelete: true,
  },
  entity_memberships: {
    basePath: '/api/v1/entity-memberships',
    dataKey: 'root',
    filterParams: ['entity_id', 'user_id', 'role'],
    supportsGetById: true,
    supportsDelete: true,
  },
  pipeline_entries: {
    basePath: '/api/v1/pipeline-entries',
    dataKey: 'root',
    filterParams: ['lead_id', 'stage', 'status'],
    supportsGetById: true,
    supportsDelete: true,
  },
  security_notifications: {
    basePath: '/api/v1/notifications', // Reusing notifications endpoint for now
    dataKey: 'root',
    filterParams: ['is_read', 'severity'],
    supportsGetById: true,
    supportsDelete: true,
  },
  mfa_settings: {
    basePath: '/api/v1/user-roles', // Temporary placeholder
    dataKey: 'root',
    filterParams: ['user_id'],
    supportsGetById: true,
    supportsDelete: false,
  },
  password_policies: {
    basePath: '/api/v1/user-roles', // Temporary placeholder
    dataKey: 'root',
    filterParams: ['is_active'],
    supportsGetById: true,
    supportsDelete: false,
  },
};

/** Tables that still need routes — currently empty after full mapping */
export const UNMAPPED_TABLES: readonly string[] = [
  // email_campaigns — add when email campaign features are built in hbf-api
  'email_campaigns',
] as const;

export function getRouteConfig(table: string): RouteConfig | null {
  return ROUTE_MAP[table] ?? null;
}