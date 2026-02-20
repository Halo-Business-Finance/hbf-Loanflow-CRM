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
};

/** Tables that still need routes — currently empty after full mapping */
export const UNMAPPED_TABLES: readonly string[] = [
  // email_campaigns — add when email campaign features are built in hbf-api
  'email_campaigns',
] as const;

export function getRouteConfig(table: string): RouteConfig | null {
  return ROUTE_MAP[table] ?? null;
}
