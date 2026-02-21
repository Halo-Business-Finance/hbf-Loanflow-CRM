/**
 * IBM RPC Route Map
 *
 * Maps PostgreSQL RPC function names to individual REST endpoints on hbf-api.
 * Each RPC gets its own dedicated route rather than a generic /rpc/:name proxy.
 */

export interface RpcRouteConfig {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** REST path on hbf-api (supports :param placeholders resolved from params) */
  path: string;
  /** How to send params: 'body' (POST JSON) or 'query' (GET query-string) */
  paramsIn: 'body' | 'query';
}

/**
 * Maps RPC function names → individual REST endpoints.
 * All paths are relative to IBM_CONFIG.database.functionsBaseUrl.
 */
export const RPC_ROUTE_MAP: Record<string, RpcRouteConfig> = {
  // ── Auth / Roles ─────────────────────────────────────────────
  get_user_role: {
    method: 'POST',
    path: '/api/v1/roles/get-user-role',
    paramsIn: 'body',
  },
  assign_user_role: {
    method: 'POST',
    path: '/api/v1/roles/assign',
    paramsIn: 'body',
  },
  revoke_user_role: {
    method: 'POST',
    path: '/api/v1/roles/revoke',
    paramsIn: 'body',
  },
  ensure_default_viewer_role: {
    method: 'POST',
    path: '/api/v1/roles/ensure-default',
    paramsIn: 'body',
  },
  is_email_verified: {
    method: 'POST',
    path: '/api/v1/auth/is-email-verified',
    paramsIn: 'body',
  },
  check_mfa_requirement: {
    method: 'POST',
    path: '/api/v1/auth/check-mfa-requirement',
    paramsIn: 'body',
  },
  mark_mfa_completed: {
    method: 'POST',
    path: '/api/v1/auth/mark-mfa-completed',
    paramsIn: 'body',
  },

  // ── Contact Data ─────────────────────────────────────────────
  get_masked_contact_data_enhanced: {
    method: 'POST',
    path: '/api/v1/data/get-masked-contact',
    paramsIn: 'body',
  },
  encrypt_contact_field_enhanced: {
    method: 'POST',
    path: '/api/v1/data/encrypt-contact-field',
    paramsIn: 'body',
  },
  grant_sensitive_data_permission: {
    method: 'POST',
    path: '/api/v1/data/grant-sensitive-permission',
    paramsIn: 'body',
  },

  // ── Document Manager ─────────────────────────────────────────
  secure_document_manager: {
    method: 'POST',
    path: '/api/v1/documents/secure-manager',
    paramsIn: 'body',
  },
  create_document_version: {
    method: 'POST',
    path: '/api/v1/documents/create-version',
    paramsIn: 'body',
  },

  // ── System ───────────────────────────────────────────────────
  is_system_shutdown: {
    method: 'POST',
    path: '/api/v1/security/is-system-shutdown',
    paramsIn: 'body',
  },
  validate_critical_operation_access: {
    method: 'POST',
    path: '/api/v1/security/validate-critical-operation',
    paramsIn: 'body',
  },



  // ── Security Events ──────────────────────────────────────────
  log_security_event: {
    method: 'POST',
    path: '/api/v1/security/log-event',
    paramsIn: 'body',
  },
  log_enhanced_security_event: {
    method: 'POST',
    path: '/api/v1/security/log-enhanced-event',
    paramsIn: 'body',
  },
  create_audit_log: {
    method: 'POST',
    path: '/api/v1/audit/create',
    paramsIn: 'body',
  },

  // ── Session Management ───────────────────────────────────────
  get_secure_session_data: {
    method: 'POST',
    path: '/api/v1/sessions/get-secure-data',
    paramsIn: 'body',
  },
  store_secure_session_data: {
    method: 'POST',
    path: '/api/v1/sessions/store-secure-data',
    paramsIn: 'body',
  },
  validate_enhanced_session: {
    method: 'POST',
    path: '/api/v1/sessions/validate-enhanced',
    paramsIn: 'body',
  },
  validate_session_with_security_checks: {
    method: 'POST',
    path: '/api/v1/sessions/validate-with-security',
    paramsIn: 'body',
  },

  // ── Threat Detection ─────────────────────────────────────────
  detect_suspicious_patterns: {
    method: 'POST',
    path: '/api/v1/security/detect-patterns',
    paramsIn: 'body',
  },
  check_user_rate_limit_secure: {
    method: 'POST',
    path: '/api/v1/security/check-rate-limit',
    paramsIn: 'body',
  },

  // ── Input Validation ─────────────────────────────────────────
  validate_and_sanitize_input_enhanced: {
    method: 'POST',
    path: '/api/v1/security/validate-input',
    paramsIn: 'body',
  },

  // ── Data Operations ──────────────────────────────────────────
  get_accessible_leads: {
    method: 'GET',
    path: '/api/v1/leads/accessible',
    paramsIn: 'query',
  },
  encrypt_existing_contact_data: {
    method: 'POST',
    path: '/api/v1/data/encrypt-contacts',
    paramsIn: 'body',
  },
  initiate_gdpr_data_deletion: {
    method: 'POST',
    path: '/api/v1/data/gdpr-delete',
    paramsIn: 'body',
  },

  // ── Documents ────────────────────────────────────────────────
  revert_to_document_version: {
    method: 'POST',
    path: '/api/v1/documents/revert-version',
    paramsIn: 'body',
  },
  increment_template_usage: {
    method: 'POST',
    path: '/api/v1/documents/increment-template-usage',
    paramsIn: 'body',
  },

  // ── Email ────────────────────────────────────────────────────
  get_email_tokens_secure: {
    method: 'POST',
    path: '/api/v1/email/get-tokens-secure',
    paramsIn: 'body',
  },
  store_secure_email_tokens: {
    method: 'POST',
    path: '/api/v1/email/store-tokens-secure',
    paramsIn: 'body',
  },

  // ── MFA / Role Change ────────────────────────────────────────
  generate_role_change_mfa_verification: {
    method: 'POST',
    path: '/api/v1/mfa/generate-role-change-verification',
    paramsIn: 'body',
  },
  verify_role_change_mfa: {
    method: 'POST',
    path: '/api/v1/mfa/verify-role-change',
    paramsIn: 'body',
  },

  // ── Pipeline ─────────────────────────────────────────────────
  get_pipeline_analytics: {
    method: 'POST',
    path: '/api/v1/pipeline/analytics',
    paramsIn: 'body',
  },

  // ── Reports ──────────────────────────────────────────────────
  get_dashboard_metrics: {
    method: 'POST',
    path: '/api/v1/reports/dashboard-metrics',
    paramsIn: 'body',
  },

  // ── Compliance ───────────────────────────────────────────────
  generate_compliance_report: {
    method: 'POST',
    path: '/api/v1/compliance/generate-report',
    paramsIn: 'body',
  },
};

/**
 * Get the route config for an RPC function.
 * Returns null if the function has no dedicated endpoint yet.
 */
export function getRpcRouteConfig(fnName: string): RpcRouteConfig | null {
  return RPC_ROUTE_MAP[fnName] ?? null;
}
