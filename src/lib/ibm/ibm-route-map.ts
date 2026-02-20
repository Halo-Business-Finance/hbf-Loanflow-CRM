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
 * and will throw an informative error when accessed.
 */
export const ROUTE_MAP: Record<string, RouteConfig> = {
  leads: {
    basePath: '/api/v1/leads',
    dataKey: 'root',
    filterParams: ['status', 'source'],
    supportsGetById: true,
    supportsDelete: true,
  },
  // contact_entities in the CRM maps to "borrowers" in hbf-api
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
};

/** Tables that need routes added to hbf-api before the CRM can use them via IBM */
export const UNMAPPED_TABLES = [
  'lenders',
  'clients',
  'service_providers',
  'profiles',
  'messages',
  'tasks',
  'document_templates',
  'document_versions',
  'email_accounts',
  'email_campaigns',
  'approval_requests',
  'approval_steps',
  'lead_documents',
] as const;

export function getRouteConfig(table: string): RouteConfig | null {
  return ROUTE_MAP[table] ?? null;
}
