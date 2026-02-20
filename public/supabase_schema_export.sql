-- =============================================================
-- Supabase Schema Export for IBM Cloud Migration
-- Project: gshxxsniwytjgcnthyfq
-- Exported: 2026-02-20
-- =============================================================

-- =====================
-- TYPES
-- =====================
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'agent', 'viewer', 'super_admin', 'loan_processor', 'underwriter', 'funder', 'closer', 'tech', 'loan_originator');

-- =====================
-- SEQUENCES
-- =====================
CREATE SEQUENCE public.leads_lead_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE public.leads_number_seq START WITH 3 INCREMENT BY 1;
CREATE SEQUENCE public.user_number_seq START WITH 3 INCREMENT BY 1;

-- =====================
-- TABLES
-- =====================

CREATE TABLE public.account_lockouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  locked_at timestamp with time zone NOT NULL DEFAULT now(),
  unlock_at timestamp with time zone NOT NULL DEFAULT (now() + '00:30:00'::interval),
  reason text NOT NULL,
  locked_by_system boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.active_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text NOT NULL,
  device_fingerprint text,
  ip_address inet,
  user_agent text,
  last_activity timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  page_url text,
  referrer text,
  session_duration_seconds integer DEFAULT 0,
  click_count integer DEFAULT 0,
  page_views integer DEFAULT 0,
  keyboard_activity_count integer DEFAULT 0,
  mouse_activity_count integer DEFAULT 0,
  scroll_activity_count integer DEFAULT 0,
  idle_time_seconds integer DEFAULT 0,
  risk_factors jsonb DEFAULT '[]'::jsonb,
  security_alerts_count integer DEFAULT 0,
  last_security_check timestamp with time zone DEFAULT now(),
  browser_fingerprint jsonb DEFAULT '{}'::jsonb,
  screen_resolution text,
  timezone text
);

CREATE TABLE public.additional_borrowers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  contact_entity_id uuid NOT NULL,
  borrower_order integer NOT NULL DEFAULT 1,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_bot_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bot_id uuid,
  activity_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  execution_time_ms integer,
  status text NOT NULL DEFAULT 'completed'::text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ai_bot_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bot_id uuid,
  alert_type text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  threat_indicators jsonb DEFAULT '{}'::jsonb,
  confidence_score numeric NOT NULL DEFAULT 0.0,
  auto_response_taken boolean DEFAULT false,
  requires_human_review boolean DEFAULT false,
  acknowledged boolean DEFAULT false,
  acknowledged_by uuid,
  acknowledged_at timestamp with time zone,
  resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ai_lead_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0,
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_best_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  predicted_close_date date,
  predicted_value numeric,
  model_version text NOT NULL DEFAULT 'v1'::text,
  scored_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_security_bots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bot_name text NOT NULL,
  bot_type text NOT NULL,
  status text NOT NULL DEFAULT 'active'::text,
  sensitivity_level text NOT NULL DEFAULT 'high'::text,
  last_activity timestamp with time zone DEFAULT now(),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  performance_metrics jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.api_request_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  endpoint text NOT NULL,
  method text NOT NULL,
  request_size integer,
  response_time integer,
  status_code integer,
  request_fingerprint text,
  is_bot_suspected boolean NOT NULL DEFAULT false,
  ai_confidence_score numeric,
  rate_limit_triggered boolean NOT NULL DEFAULT false,
  blocked boolean NOT NULL DEFAULT false,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.application_escalations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  escalated_from uuid NOT NULL,
  escalated_to uuid NOT NULL,
  reason text NOT NULL,
  priority text NOT NULL DEFAULT 'high'::text,
  status text NOT NULL DEFAULT 'pending'::text,
  resolution text,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.approval_processes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  object_type text NOT NULL,
  entry_criteria jsonb,
  approval_steps jsonb NOT NULL,
  final_approval_actions jsonb,
  final_rejection_actions jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.approval_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL,
  record_id uuid NOT NULL,
  record_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  current_step integer NOT NULL DEFAULT 1,
  submitted_by uuid NOT NULL,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  comments text
);

CREATE TABLE public.approval_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  step_number integer NOT NULL,
  approver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  comments text,
  actioned_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  session_id text,
  risk_score integer DEFAULT 0
);

CREATE TABLE public.blockchain_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  record_type text NOT NULL,
  record_id text NOT NULL,
  data_hash text NOT NULL,
  blockchain_hash text,
  block_number bigint,
  transaction_hash text,
  verified_at timestamp with time zone,
  verification_status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE public.business_entities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_type text NOT NULL DEFAULT 'branch'::text,
  parent_entity_id uuid,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.case_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  user_id uuid NOT NULL,
  comment_text text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  comment_type text NOT NULL DEFAULT 'comment'::text,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.cases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL,
  case_number text NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'medium'::text,
  status text NOT NULL DEFAULT 'new'::text,
  case_type text NOT NULL DEFAULT 'support'::text,
  resolution text,
  resolution_date timestamp with time zone,
  due_date timestamp with time zone,
  escalated_to uuid,
  escalation_reason text,
  customer_satisfaction_score integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid,
  status text NOT NULL DEFAULT 'Active'::text,
  total_loans integer DEFAULT 0,
  total_loan_value numeric DEFAULT 0,
  join_date timestamp with time zone DEFAULT now(),
  last_activity timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  contact_entity_id uuid NOT NULL
);

CREATE TABLE public.communities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  community_type text NOT NULL DEFAULT 'client'::text,
  is_active boolean NOT NULL DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.community_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL,
  user_id uuid,
  client_id uuid,
  role text NOT NULL DEFAULT 'member'::text,
  status text NOT NULL DEFAULT 'active'::text,
  joined_at timestamp with time zone DEFAULT now(),
  last_activity timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.compliance_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  generated_by uuid NOT NULL,
  date_range_start timestamp with time zone NOT NULL,
  date_range_end timestamp with time zone NOT NULL,
  filters jsonb DEFAULT '{}'::jsonb,
  report_data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'generating'::text,
  file_path text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

CREATE TABLE public.contact_encrypted_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL,
  field_name text NOT NULL,
  encrypted_value text NOT NULL,
  field_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.contact_entities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  location text,
  business_name text,
  business_address text,
  year_established integer,
  naics_code text,
  ownership_structure text,
  annual_revenue numeric,
  income numeric,
  credit_score integer,
  loan_amount numeric,
  loan_type text,
  interest_rate numeric,
  maturity_date date,
  existing_loan_amount numeric,
  net_operating_income numeric,
  property_payment_amount numeric,
  owns_property boolean DEFAULT false,
  pos_system text,
  processor_name text,
  current_processing_rate numeric,
  monthly_processing_volume numeric,
  average_transaction_size numeric,
  bdo_name text,
  bdo_telephone text,
  bdo_email text,
  bank_lender_name text,
  stage text,
  priority text DEFAULT 'medium'::text,
  notes text,
  call_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  ownership_percentage numeric,
  mobile_phone text,
  personal_email text,
  first_name text,
  last_name text,
  business_city text,
  business_state text,
  business_zip_code text,
  home_address text,
  home_city text,
  home_state text,
  home_zip_code text,
  source text,
  tax_id text,
  business_type text,
  years_in_business integer,
  employees integer,
  monthly_revenue numeric,
  debt_to_income_ratio numeric,
  collateral_value numeric,
  requested_amount numeric,
  purpose_of_loan text,
  time_in_business text,
  industry text,
  website text,
  social_media text,
  referral_source text,
  campaign_source text,
  lead_score integer,
  last_activity timestamp with time zone,
  next_follow_up timestamp with time zone,
  conversion_probability numeric,
  lender_id uuid,
  title_company_id uuid,
  escrow_company_id uuid
);

CREATE TABLE public.custom_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  object_id uuid NOT NULL,
  name text NOT NULL,
  api_name text NOT NULL,
  field_type text NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  default_value text,
  picklist_values jsonb,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.custom_objects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  api_name text NOT NULL,
  description text,
  icon text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.custom_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  object_id uuid NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.dashboard_widgets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  widget_type text NOT NULL,
  title text NOT NULL,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  position_x integer NOT NULL DEFAULT 0,
  position_y integer NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 4,
  height integer NOT NULL DEFAULT 3,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.data_import_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_name text NOT NULL,
  job_type text NOT NULL,
  data_type text NOT NULL,
  file_path text,
  file_format text NOT NULL,
  mapping_configuration jsonb,
  status text NOT NULL DEFAULT 'pending'::text,
  total_records integer DEFAULT 0,
  processed_records integer DEFAULT 0,
  successful_records integer DEFAULT 0,
  failed_records integer DEFAULT 0,
  error_log jsonb DEFAULT '[]'::jsonb,
  progress_percentage numeric DEFAULT 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.data_integrity_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  check_type text NOT NULL,
  table_name text NOT NULL,
  record_id text,
  expected_hash text NOT NULL,
  actual_hash text,
  status text NOT NULL DEFAULT 'pending'::text,
  discrepancies jsonb DEFAULT '[]'::jsonb,
  checked_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.device_fingerprints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  fingerprint_hash text NOT NULL,
  device_characteristics jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen timestamp with time zone NOT NULL DEFAULT now(),
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  is_suspicious boolean NOT NULL DEFAULT false,
  risk_score integer NOT NULL DEFAULT 0,
  ai_detection_flags jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.document_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_id uuid NOT NULL,
  document_name text NOT NULL,
  view_started_at timestamp with time zone NOT NULL DEFAULT now(),
  view_ended_at timestamp with time zone,
  total_view_time_seconds integer DEFAULT 0,
  pages_viewed jsonb DEFAULT '[]'::jsonb,
  max_page_reached integer DEFAULT 1,
  zoom_events integer DEFAULT 0,
  download_attempted boolean DEFAULT false,
  print_attempted boolean DEFAULT false,
  viewer_type text DEFAULT 'adobe'::text,
  session_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.document_error_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  document_id uuid,
  document_name text,
  error_type text NOT NULL,
  error_message text NOT NULL,
  error_stack text,
  viewer_type text,
  browser_info jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.document_scan_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  file_hash text NOT NULL,
  file_name text,
  file_size bigint,
  document_id uuid,
  is_safe boolean NOT NULL DEFAULT true,
  scan_id text,
  threats_found text[] DEFAULT '{}'::text[],
  confidence integer DEFAULT 0,
  scanned_at timestamp with time zone NOT NULL DEFAULT now(),
  scanned_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.document_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  template_type text NOT NULL,
  file_path text NOT NULL,
  file_format text NOT NULL,
  file_size integer,
  usage_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_modified timestamp with time zone DEFAULT now()
);

CREATE TABLE public.document_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  version_number integer NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  file_mime_type text NOT NULL,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  change_description text,
  is_current boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  checksum text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.email_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_address text NOT NULL,
  display_name text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.email_campaign_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  lead_id uuid,
  client_id uuid,
  email_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  sent_at timestamp with time zone,
  opened_at timestamp with time zone,
  clicked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.email_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  campaign_type text NOT NULL DEFAULT 'drip'::text,
  status text NOT NULL DEFAULT 'draft'::text,
  subject_line text,
  email_template text,
  trigger_conditions jsonb,
  send_schedule jsonb,
  target_audience jsonb,
  performance_metrics jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.emergency_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  threat_type text NOT NULL,
  severity text NOT NULL,
  trigger_source text NOT NULL,
  auto_shutdown boolean NOT NULL DEFAULT false,
  manual_override boolean NOT NULL DEFAULT false,
  event_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.emergency_shutdown (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reason text NOT NULL,
  shutdown_level text NOT NULL,
  triggered_by text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  auto_restore_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.encrypted_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  field_name text NOT NULL,
  record_id text NOT NULL,
  encryption_key_id uuid NOT NULL,
  encrypted_value text NOT NULL,
  encryption_algorithm text NOT NULL DEFAULT 'AES-256-GCM'::text,
  salt text NOT NULL,
  iv text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.encryption_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key_name text NOT NULL,
  key_purpose text NOT NULL,
  algorithm text NOT NULL DEFAULT 'AES-256-GCM'::text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  last_rotated timestamp with time zone DEFAULT now(),
  key_material text
);

CREATE TABLE public.entity_memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member'::text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.event_attendees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  lead_id uuid,
  client_id uuid,
  email text NOT NULL,
  name text NOT NULL,
  registration_status text NOT NULL DEFAULT 'registered'::text,
  registration_date timestamp with time zone DEFAULT now(),
  attendance_date timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'webinar'::text,
  status text NOT NULL DEFAULT 'planned'::text,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  location text,
  virtual_link text,
  max_attendees integer,
  registration_required boolean DEFAULT true,
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.failed_login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address inet,
  user_agent text,
  attempt_time timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.field_level_security (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  field_name text NOT NULL,
  role_restrictions jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_restrictions jsonb DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.forecast_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  period_type text NOT NULL,
  status text NOT NULL DEFAULT 'open'::text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.forecasts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL,
  user_id uuid NOT NULL,
  territory_id uuid,
  methodology text NOT NULL,
  amount numeric NOT NULL,
  quota numeric,
  confidence_level integer,
  notes text,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.immutable_audit_trail (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text,
  record_id text,
  old_values_hash text,
  new_values_hash text,
  blockchain_record_id uuid,
  timestamp_hash text NOT NULL,
  verification_proof text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_verified boolean DEFAULT false
);

CREATE TABLE public.integration_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  integration_type text NOT NULL,
  name text NOT NULL,
  provider text NOT NULL,
  credentials_encrypted text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'::text,
  last_sync_at timestamp with time zone,
  error_message text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.integration_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  action text NOT NULL,
  status text NOT NULL,
  request_data jsonb,
  response_data jsonb,
  error_message text,
  duration_ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.ip_restrictions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ip_address inet NOT NULL,
  country_code text,
  is_allowed boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.knowledge_articles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  summary text,
  category text NOT NULL,
  tags text[],
  status text NOT NULL DEFAULT 'draft'::text,
  visibility text NOT NULL DEFAULT 'internal'::text,
  view_count integer DEFAULT 0,
  helpful_count integer DEFAULT 0,
  not_helpful_count integer DEFAULT 0,
  last_reviewed timestamp with time zone,
  reviewed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  contact_entity_id uuid,
  user_id uuid NOT NULL,
  document_name text NOT NULL,
  document_type text NOT NULL,
  file_path text,
  file_size bigint,
  file_mime_type text,
  status text NOT NULL DEFAULT 'pending'::text,
  uploaded_at timestamp with time zone DEFAULT now(),
  verified_at timestamp with time zone,
  verified_by uuid,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  current_version integer DEFAULT 1,
  total_versions integer DEFAULT 1,
  last_version_date timestamp with time zone DEFAULT now()
);

CREATE TABLE public.lead_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  scoring_model_id uuid NOT NULL,
  behavioral_score integer NOT NULL DEFAULT 0,
  demographic_score integer NOT NULL DEFAULT 0,
  total_score integer NOT NULL DEFAULT 0,
  score_category text NOT NULL DEFAULT 'cold'::text,
  last_calculated timestamp with time zone NOT NULL DEFAULT now(),
  score_history jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_scoring_models (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  behavioral_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  demographic_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  score_thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  last_contact timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_converted_to_client boolean DEFAULT false,
  converted_at timestamp with time zone,
  contact_entity_id uuid NOT NULL,
  lead_number integer NOT NULL DEFAULT nextval('leads_number_seq'::regclass),
  loan_originator_id uuid,
  processor_id uuid,
  underwriter_id uuid,
  assigned_at timestamp with time zone
);

CREATE TABLE public.lender_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lender_id uuid NOT NULL,
  name text NOT NULL,
  title text,
  email text,
  phone text,
  mobile_phone text,
  is_primary boolean NOT NULL DEFAULT false,
  is_bdo boolean NOT NULL DEFAULT false,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  is_closer boolean NOT NULL DEFAULT false,
  is_vice_president boolean NOT NULL DEFAULT false
);

CREATE TABLE public.lenders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  lender_type text NOT NULL DEFAULT 'bank'::text,
  address text,
  city text,
  state text,
  zip_code text,
  phone text,
  email text,
  website text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  logo_url text
);

CREATE TABLE public.loan_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid,
  client_id uuid,
  user_id uuid NOT NULL,
  loan_amount numeric NOT NULL,
  loan_type text NOT NULL DEFAULT 'SBA 7(a) Loan'::text,
  interest_rate numeric,
  loan_term_months integer,
  purpose text,
  status text NOT NULL DEFAULT 'draft'::text,
  priority text NOT NULL DEFAULT 'medium'::text,
  submitted_at timestamp with time zone,
  approved_at timestamp with time zone,
  funded_at timestamp with time zone,
  notes text,
  documents jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  lender_id uuid
);

CREATE TABLE public.loan_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  order_position integer NOT NULL,
  probability integer NOT NULL DEFAULT 50,
  color text NOT NULL DEFAULT 'blue'::text,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.loans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid,
  lead_id uuid,
  loan_amount numeric NOT NULL,
  interest_rate numeric,
  loan_term_months integer,
  maturity_date date,
  loan_type text DEFAULT 'Mortgage'::text,
  status text DEFAULT 'Active'::text,
  origination_date date DEFAULT CURRENT_DATE,
  monthly_payment numeric,
  remaining_balance numeric,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.mfa_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  secret_key text,
  backup_codes text[],
  phone_number text,
  preferred_method text NOT NULL DEFAULT 'totp'::text,
  last_used timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.notes_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL,
  note_type text NOT NULL,
  content text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info'::text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  related_id uuid,
  related_type text,
  scheduled_for timestamp with time zone
);

CREATE TABLE public.opportunities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric NOT NULL,
  close_date date NOT NULL,
  stage text NOT NULL,
  probability integer,
  lead_id uuid,
  client_id uuid,
  territory_id uuid,
  primary_owner_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.opportunity_splits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL,
  user_id uuid NOT NULL,
  split_type text NOT NULL,
  percentage numeric NOT NULL,
  amount numeric,
  role text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.partner_organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  partner_type text NOT NULL DEFAULT 'broker'::text,
  contact_email text NOT NULL,
  contact_phone text,
  commission_rate numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'active'::text,
  api_key_hash text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.partner_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  submitted_by uuid NOT NULL,
  borrower_name text NOT NULL,
  borrower_email text NOT NULL,
  borrower_phone text,
  loan_amount numeric NOT NULL,
  loan_type text NOT NULL,
  business_name text,
  notes text,
  status text NOT NULL DEFAULT 'pending'::text,
  assigned_to uuid,
  converted_lead_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.partner_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member'::text,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.password_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  password_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.password_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  min_length integer NOT NULL DEFAULT 12,
  require_uppercase boolean NOT NULL DEFAULT true,
  require_lowercase boolean NOT NULL DEFAULT true,
  require_numbers boolean NOT NULL DEFAULT true,
  require_special_chars boolean NOT NULL DEFAULT true,
  max_age_days integer NOT NULL DEFAULT 90,
  prevent_reuse_count integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.pipeline_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid,
  client_id uuid,
  stage text NOT NULL,
  amount numeric,
  priority text NOT NULL DEFAULT 'medium'::text,
  notes text,
  last_contact timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.profile_encrypted_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  field_name text NOT NULL,
  encrypted_value text NOT NULL,
  field_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  first_name text,
  last_name text,
  phone_number text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  email text,
  is_active boolean DEFAULT true,
  job_title text,
  language text DEFAULT 'en-US'::text,
  timezone text DEFAULT 'America/New_York'::text,
  email_notifications boolean DEFAULT true,
  new_application_alerts boolean DEFAULT true,
  status_change_notifications boolean DEFAULT true,
  daily_summary_reports boolean DEFAULT false,
  archived_at timestamp with time zone,
  archived_by uuid,
  archive_reason text,
  user_number integer,
  city text,
  state text,
  email_verified_at timestamp with time zone,
  phone_verified_at timestamp with time zone,
  phone_verification_code text,
  phone_verification_expires_at timestamp with time zone,
  phone_verification_attempts integer DEFAULT 0
);

CREATE TABLE public.rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action_type text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  is_blocked boolean NOT NULL DEFAULT false,
  block_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.report_execution_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  user_id uuid,
  execution_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  row_count integer,
  execution_time_ms integer,
  error_message text,
  export_path text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

CREATE TABLE public.report_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  user_id uuid NOT NULL,
  schedule_type text NOT NULL,
  day_of_week integer,
  day_of_month integer,
  time_of_day time without time zone NOT NULL DEFAULT '08:00:00'::time without time zone,
  timezone text DEFAULT 'America/New_York'::text,
  delivery_method text NOT NULL DEFAULT 'email'::text,
  delivery_config jsonb DEFAULT '{}'::jsonb,
  export_format text DEFAULT 'pdf'::text,
  is_active boolean DEFAULT true,
  last_sent_at timestamp with time zone,
  next_send_at timestamp with time zone,
  send_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.report_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_id uuid NOT NULL,
  notification_enabled boolean DEFAULT true,
  email_on_change boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.ringcentral_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  server_url text NOT NULL DEFAULT 'https://platform.ringcentral.com'::text,
  username text NOT NULL,
  extension text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.ringcentral_encrypted_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  field_name text NOT NULL,
  encrypted_value text NOT NULL,
  field_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.role_change_mfa_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  verification_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '00:05:00'::interval),
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.saved_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  report_type text NOT NULL DEFAULT 'custom'::text,
  data_source text NOT NULL,
  selected_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb DEFAULT '[]'::jsonb,
  sort_by text,
  sort_order text DEFAULT 'asc'::text,
  group_by text,
  chart_type text,
  is_public boolean DEFAULT false,
  is_favorite boolean DEFAULT false,
  last_run_at timestamp with time zone,
  run_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.secure_session_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_key text NOT NULL,
  session_value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '08:00:00'::interval)
);

CREATE TABLE public.secure_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text NOT NULL,
  ip_address inet,
  user_agent text,
  device_fingerprint text,
  location_data jsonb,
  is_suspicious boolean NOT NULL DEFAULT false,
  risk_score integer NOT NULL DEFAULT 0,
  last_activity timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '24:00:00'::interval),
  is_active boolean NOT NULL DEFAULT true,
  mfa_verified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.security_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  user_id uuid,
  ip_address inet,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  auto_resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.security_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.security_configuration (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  config_key text NOT NULL,
  config_value jsonb NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

CREATE TABLE public.security_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL,
  severity text NOT NULL,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.security_headers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  header_name text NOT NULL,
  header_value text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.security_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'medium'::text,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.security_pattern_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pattern_type text NOT NULL,
  severity text NOT NULL,
  detection_count integer NOT NULL,
  description text NOT NULL,
  affected_user_ids uuid[] NOT NULL,
  detected_at timestamp with time zone NOT NULL DEFAULT now(),
  acknowledged boolean DEFAULT false,
  acknowledged_by uuid,
  acknowledged_at timestamp with time zone,
  resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  resolution_notes text
);

CREATE TABLE public.sensitive_data_access_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  data_type text NOT NULL,
  fields_accessed text[],
  access_reason text,
  permission_id uuid,
  ip_address inet,
  user_agent text,
  session_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.sensitive_data_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  permission_type text NOT NULL,
  granted_by uuid NOT NULL,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  business_justification text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  revoked_at timestamp with time zone,
  revoked_by uuid,
  revoke_reason text,
  access_count integer DEFAULT 0,
  last_accessed timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.service_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider_type text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  zip_code text,
  website text,
  logo_url text,
  service_areas jsonb DEFAULT '[]'::jsonb,
  license_numbers jsonb DEFAULT '{}'::jsonb,
  insurance_info jsonb DEFAULT '{}'::jsonb,
  certifications jsonb DEFAULT '[]'::jsonb,
  average_closing_days integer,
  success_rate numeric,
  total_closings integer DEFAULT 0,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.session_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid,
  user_id uuid NOT NULL,
  activity_type text NOT NULL,
  page_url text,
  action_type text,
  element_id text,
  "timestamp" timestamp with time zone NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  device_fingerprint text,
  geolocation jsonb DEFAULT '{}'::jsonb,
  performance_metrics jsonb DEFAULT '{}'::jsonb,
  risk_indicators jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE public.session_anomalies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text NOT NULL,
  anomaly_type text NOT NULL,
  risk_score integer NOT NULL DEFAULT 0,
  details jsonb DEFAULT '{}'::jsonb,
  resolved boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.session_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_timeout_minutes integer NOT NULL DEFAULT 30,
  max_concurrent_sessions integer NOT NULL DEFAULT 3,
  require_fresh_login_minutes integer NOT NULL DEFAULT 120,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.sla_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_type text NOT NULL DEFAULT 'lead'::text,
  response_time_hours integer NOT NULL DEFAULT 24,
  resolution_time_hours integer NOT NULL DEFAULT 72,
  escalation_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority_multipliers jsonb NOT NULL DEFAULT '{"low": 1.5, "high": 0.5, "medium": 1}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.sla_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  first_response_at timestamp with time zone,
  resolved_at timestamp with time zone,
  response_deadline timestamp with time zone NOT NULL,
  resolution_deadline timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'open'::text,
  escalation_level integer NOT NULL DEFAULT 0,
  last_escalated_at timestamp with time zone,
  assigned_to uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.social_media_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid,
  client_id uuid,
  platform text NOT NULL,
  profile_url text,
  profile_data jsonb DEFAULT '{}'::jsonb,
  last_updated timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.sso_configurations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider_name text NOT NULL,
  provider_type text NOT NULL,
  configuration jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  domain_restrictions text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open'::text,
  priority text NOT NULL DEFAULT 'medium'::text,
  category text NOT NULL DEFAULT 'General'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.task_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  task_type text NOT NULL,
  priority text NOT NULL DEFAULT 'medium'::text,
  status text NOT NULL DEFAULT 'pending'::text,
  assigned_to uuid NOT NULL,
  assigned_by uuid NOT NULL,
  related_entity_id uuid,
  related_entity_type text,
  due_date timestamp with time zone,
  completed_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.territories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  parent_id uuid,
  territory_type text NOT NULL,
  rules jsonb NOT NULL,
  manager_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.territory_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  territory_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  assigned_by uuid NOT NULL,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.threat_incidents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  incident_type text NOT NULL,
  severity text NOT NULL,
  threat_vector text NOT NULL,
  ai_generated boolean NOT NULL DEFAULT false,
  incident_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  response_action text,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.user_behavior_patterns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text NOT NULL,
  action_sequence jsonb NOT NULL DEFAULT '[]'::jsonb,
  timing_patterns jsonb NOT NULL DEFAULT '{}'::jsonb,
  mouse_patterns jsonb DEFAULT '{}'::jsonb,
  keyboard_patterns jsonb DEFAULT '{}'::jsonb,
  ai_likelihood_score integer NOT NULL DEFAULT 0,
  anomaly_flags jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.user_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  parent_message_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.user_mfa_status (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mfa_setup_required boolean NOT NULL DEFAULT true,
  mfa_setup_completed boolean NOT NULL DEFAULT false,
  login_count_since_required integer NOT NULL DEFAULT 0,
  last_login_at timestamp with time zone,
  mfa_required_since timestamp with time zone NOT NULL DEFAULT now(),
  mfa_completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role user_role NOT NULL DEFAULT 'agent'::user_role,
  assigned_by uuid,
  assigned_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  archived_at timestamp with time zone,
  archived_by uuid,
  archive_reason text
);

CREATE TABLE public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text NOT NULL,
  ip_address inet,
  user_agent text,
  last_activity timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '24:00:00'::interval),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data_protection_settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.workflow_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL,
  record_id uuid NOT NULL,
  status text NOT NULL,
  execution_data jsonb,
  error_message text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

CREATE TABLE public.workflows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  object_type text NOT NULL,
  trigger_type text NOT NULL,
  trigger_conditions jsonb,
  flow_definition jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- =====================
-- PRIMARY KEYS
-- =====================
ALTER TABLE public.account_lockouts ADD CONSTRAINT account_lockouts_pkey PRIMARY KEY (id);
ALTER TABLE public.active_sessions ADD CONSTRAINT active_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.additional_borrowers ADD CONSTRAINT additional_borrowers_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_bot_activity ADD CONSTRAINT ai_bot_activity_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_bot_alerts ADD CONSTRAINT ai_bot_alerts_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_lead_scores ADD CONSTRAINT ai_lead_scores_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_security_bots ADD CONSTRAINT ai_security_bots_pkey PRIMARY KEY (id);
ALTER TABLE public.api_request_analytics ADD CONSTRAINT api_request_analytics_pkey PRIMARY KEY (id);
ALTER TABLE public.application_escalations ADD CONSTRAINT application_escalations_pkey PRIMARY KEY (id);
ALTER TABLE public.approval_processes ADD CONSTRAINT approval_processes_pkey PRIMARY KEY (id);
ALTER TABLE public.approval_requests ADD CONSTRAINT approval_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.approval_steps ADD CONSTRAINT approval_steps_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.blockchain_records ADD CONSTRAINT blockchain_records_pkey PRIMARY KEY (id);
ALTER TABLE public.business_entities ADD CONSTRAINT business_entities_pkey PRIMARY KEY (id);
ALTER TABLE public.case_comments ADD CONSTRAINT case_comments_pkey PRIMARY KEY (id);
ALTER TABLE public.cases ADD CONSTRAINT cases_pkey PRIMARY KEY (id);
ALTER TABLE public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
ALTER TABLE public.communities ADD CONSTRAINT communities_pkey PRIMARY KEY (id);
ALTER TABLE public.community_members ADD CONSTRAINT community_members_pkey PRIMARY KEY (id);
ALTER TABLE public.compliance_reports ADD CONSTRAINT compliance_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.contact_encrypted_fields ADD CONSTRAINT contact_encrypted_fields_pkey PRIMARY KEY (id);
ALTER TABLE public.contact_entities ADD CONSTRAINT contact_entities_pkey PRIMARY KEY (id);
ALTER TABLE public.custom_fields ADD CONSTRAINT custom_fields_pkey PRIMARY KEY (id);
ALTER TABLE public.custom_objects ADD CONSTRAINT custom_objects_pkey PRIMARY KEY (id);
ALTER TABLE public.custom_records ADD CONSTRAINT custom_records_pkey PRIMARY KEY (id);
ALTER TABLE public.dashboard_widgets ADD CONSTRAINT dashboard_widgets_pkey PRIMARY KEY (id);
ALTER TABLE public.data_import_jobs ADD CONSTRAINT data_import_jobs_pkey PRIMARY KEY (id);
ALTER TABLE public.data_integrity_checks ADD CONSTRAINT data_integrity_checks_pkey PRIMARY KEY (id);
ALTER TABLE public.device_fingerprints ADD CONSTRAINT device_fingerprints_pkey PRIMARY KEY (id);
ALTER TABLE public.document_analytics ADD CONSTRAINT document_analytics_pkey PRIMARY KEY (id);
ALTER TABLE public.document_error_logs ADD CONSTRAINT document_error_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.document_scan_results ADD CONSTRAINT document_scan_results_pkey PRIMARY KEY (id);
ALTER TABLE public.document_templates ADD CONSTRAINT document_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.document_versions ADD CONSTRAINT document_versions_pkey PRIMARY KEY (id);
ALTER TABLE public.email_accounts ADD CONSTRAINT email_accounts_pkey PRIMARY KEY (id);
ALTER TABLE public.email_campaign_recipients ADD CONSTRAINT email_campaign_recipients_pkey PRIMARY KEY (id);
ALTER TABLE public.email_campaigns ADD CONSTRAINT email_campaigns_pkey PRIMARY KEY (id);
ALTER TABLE public.emergency_events ADD CONSTRAINT emergency_events_pkey PRIMARY KEY (id);
ALTER TABLE public.emergency_shutdown ADD CONSTRAINT emergency_shutdown_pkey PRIMARY KEY (id);
ALTER TABLE public.encrypted_fields ADD CONSTRAINT encrypted_fields_pkey PRIMARY KEY (id);
ALTER TABLE public.encryption_keys ADD CONSTRAINT encryption_keys_pkey PRIMARY KEY (id);
ALTER TABLE public.entity_memberships ADD CONSTRAINT entity_memberships_pkey PRIMARY KEY (id);
ALTER TABLE public.event_attendees ADD CONSTRAINT event_attendees_pkey PRIMARY KEY (id);
ALTER TABLE public.events ADD CONSTRAINT events_pkey PRIMARY KEY (id);
ALTER TABLE public.failed_login_attempts ADD CONSTRAINT failed_login_attempts_pkey PRIMARY KEY (id);
ALTER TABLE public.field_level_security ADD CONSTRAINT field_level_security_pkey PRIMARY KEY (id);
ALTER TABLE public.forecast_periods ADD CONSTRAINT forecast_periods_pkey PRIMARY KEY (id);
ALTER TABLE public.forecasts ADD CONSTRAINT forecasts_pkey PRIMARY KEY (id);
ALTER TABLE public.immutable_audit_trail ADD CONSTRAINT immutable_audit_trail_pkey PRIMARY KEY (id);
ALTER TABLE public.integration_connections ADD CONSTRAINT integration_connections_pkey PRIMARY KEY (id);
ALTER TABLE public.integration_logs ADD CONSTRAINT integration_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.ip_restrictions ADD CONSTRAINT ip_restrictions_pkey PRIMARY KEY (id);
ALTER TABLE public.knowledge_articles ADD CONSTRAINT knowledge_articles_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_documents ADD CONSTRAINT lead_documents_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_scores ADD CONSTRAINT lead_scores_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_scoring_models ADD CONSTRAINT lead_scoring_models_pkey PRIMARY KEY (id);
ALTER TABLE public.leads ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
ALTER TABLE public.lender_contacts ADD CONSTRAINT lender_contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.lenders ADD CONSTRAINT lenders_pkey PRIMARY KEY (id);
ALTER TABLE public.loan_requests ADD CONSTRAINT loan_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.loan_stages ADD CONSTRAINT loan_stages_pkey PRIMARY KEY (id);
ALTER TABLE public.loans ADD CONSTRAINT loans_pkey PRIMARY KEY (id);
ALTER TABLE public.mfa_settings ADD CONSTRAINT mfa_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.notes_history ADD CONSTRAINT notes_history_pkey PRIMARY KEY (id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_pkey PRIMARY KEY (id);
ALTER TABLE public.opportunity_splits ADD CONSTRAINT opportunity_splits_pkey PRIMARY KEY (id);
ALTER TABLE public.partner_organizations ADD CONSTRAINT partner_organizations_pkey PRIMARY KEY (id);
ALTER TABLE public.partner_submissions ADD CONSTRAINT partner_submissions_pkey PRIMARY KEY (id);
ALTER TABLE public.partner_users ADD CONSTRAINT partner_users_pkey PRIMARY KEY (id);
ALTER TABLE public.password_history ADD CONSTRAINT password_history_pkey PRIMARY KEY (id);
ALTER TABLE public.password_policies ADD CONSTRAINT password_policies_pkey PRIMARY KEY (id);
ALTER TABLE public.pipeline_entries ADD CONSTRAINT pipeline_entries_pkey PRIMARY KEY (id);
ALTER TABLE public.profile_encrypted_fields ADD CONSTRAINT profile_encrypted_fields_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.rate_limits ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (id);
ALTER TABLE public.report_execution_logs ADD CONSTRAINT report_execution_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.report_schedules ADD CONSTRAINT report_schedules_pkey PRIMARY KEY (id);
ALTER TABLE public.report_subscriptions ADD CONSTRAINT report_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.ringcentral_accounts ADD CONSTRAINT ringcentral_accounts_pkey PRIMARY KEY (id);
ALTER TABLE public.ringcentral_encrypted_fields ADD CONSTRAINT ringcentral_encrypted_fields_pkey PRIMARY KEY (id);
ALTER TABLE public.role_change_mfa_verifications ADD CONSTRAINT role_change_mfa_verifications_pkey PRIMARY KEY (id);
ALTER TABLE public.saved_reports ADD CONSTRAINT saved_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.secure_session_data ADD CONSTRAINT secure_session_data_pkey PRIMARY KEY (id);
ALTER TABLE public.secure_sessions ADD CONSTRAINT secure_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.security_alerts ADD CONSTRAINT security_alerts_pkey PRIMARY KEY (id);
ALTER TABLE public.security_config ADD CONSTRAINT security_config_pkey PRIMARY KEY (id);
ALTER TABLE public.security_configuration ADD CONSTRAINT security_configuration_pkey PRIMARY KEY (id);
ALTER TABLE public.security_events ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);
ALTER TABLE public.security_headers ADD CONSTRAINT security_headers_pkey PRIMARY KEY (id);
ALTER TABLE public.security_notifications ADD CONSTRAINT security_notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.security_pattern_alerts ADD CONSTRAINT security_pattern_alerts_pkey PRIMARY KEY (id);
ALTER TABLE public.sensitive_data_access_logs ADD CONSTRAINT sensitive_data_access_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.sensitive_data_permissions ADD CONSTRAINT sensitive_data_permissions_pkey PRIMARY KEY (id);
ALTER TABLE public.service_providers ADD CONSTRAINT service_providers_pkey PRIMARY KEY (id);
ALTER TABLE public.session_activity_log ADD CONSTRAINT session_activity_log_pkey PRIMARY KEY (id);
ALTER TABLE public.session_anomalies ADD CONSTRAINT session_anomalies_pkey PRIMARY KEY (id);
ALTER TABLE public.session_config ADD CONSTRAINT session_config_pkey PRIMARY KEY (id);
ALTER TABLE public.sla_policies ADD CONSTRAINT sla_policies_pkey PRIMARY KEY (id);
ALTER TABLE public.sla_tracking ADD CONSTRAINT sla_tracking_pkey PRIMARY KEY (id);
ALTER TABLE public.social_media_profiles ADD CONSTRAINT social_media_profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.sso_configurations ADD CONSTRAINT sso_configurations_pkey PRIMARY KEY (id);
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);
ALTER TABLE public.task_assignments ADD CONSTRAINT task_assignments_pkey PRIMARY KEY (id);
ALTER TABLE public.territories ADD CONSTRAINT territories_pkey PRIMARY KEY (id);
ALTER TABLE public.territory_assignments ADD CONSTRAINT territory_assignments_pkey PRIMARY KEY (id);
ALTER TABLE public.threat_incidents ADD CONSTRAINT threat_incidents_pkey PRIMARY KEY (id);
ALTER TABLE public.user_behavior_patterns ADD CONSTRAINT user_behavior_patterns_pkey PRIMARY KEY (id);
ALTER TABLE public.user_messages ADD CONSTRAINT user_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.user_mfa_status ADD CONSTRAINT user_mfa_status_pkey PRIMARY KEY (id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE public.user_sessions ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.workflow_executions ADD CONSTRAINT workflow_executions_pkey PRIMARY KEY (id);
ALTER TABLE public.workflows ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);

-- =====================
-- FOREIGN KEYS
-- =====================
ALTER TABLE public.additional_borrowers ADD CONSTRAINT additional_borrowers_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);
ALTER TABLE public.additional_borrowers ADD CONSTRAINT additional_borrowers_contact_entity_id_fkey FOREIGN KEY (contact_entity_id) REFERENCES public.contact_entities(id);
ALTER TABLE public.ai_bot_activity ADD CONSTRAINT ai_bot_activity_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.ai_security_bots(id);
ALTER TABLE public.ai_bot_alerts ADD CONSTRAINT ai_bot_alerts_bot_id_fkey FOREIGN KEY (bot_id) REFERENCES public.ai_security_bots(id);
ALTER TABLE public.approval_requests ADD CONSTRAINT approval_requests_process_id_fkey FOREIGN KEY (process_id) REFERENCES public.approval_processes(id);
ALTER TABLE public.approval_steps ADD CONSTRAINT approval_steps_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.approval_requests(id);
ALTER TABLE public.business_entities ADD CONSTRAINT business_entities_parent_entity_id_fkey FOREIGN KEY (parent_entity_id) REFERENCES public.business_entities(id);
ALTER TABLE public.case_comments ADD CONSTRAINT case_comments_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id);
ALTER TABLE public.cases ADD CONSTRAINT cases_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);
ALTER TABLE public.clients ADD CONSTRAINT clients_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);
ALTER TABLE public.clients ADD CONSTRAINT fk_clients_contact_entity FOREIGN KEY (contact_entity_id) REFERENCES public.contact_entities(id);
ALTER TABLE public.community_members ADD CONSTRAINT community_members_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id);
ALTER TABLE public.community_members ADD CONSTRAINT community_members_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);
ALTER TABLE public.contact_encrypted_fields ADD CONSTRAINT contact_encrypted_fields_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contact_entities(id);
ALTER TABLE public.contact_entities ADD CONSTRAINT contact_entities_title_company_id_fkey FOREIGN KEY (title_company_id) REFERENCES public.service_providers(id);
ALTER TABLE public.contact_entities ADD CONSTRAINT contact_entities_escrow_company_id_fkey FOREIGN KEY (escrow_company_id) REFERENCES public.service_providers(id);
ALTER TABLE public.contact_entities ADD CONSTRAINT contact_entities_lender_id_fkey FOREIGN KEY (lender_id) REFERENCES public.lenders(id);
ALTER TABLE public.custom_fields ADD CONSTRAINT custom_fields_object_id_fkey FOREIGN KEY (object_id) REFERENCES public.custom_objects(id);
ALTER TABLE public.custom_records ADD CONSTRAINT custom_records_object_id_fkey FOREIGN KEY (object_id) REFERENCES public.custom_objects(id);
ALTER TABLE public.document_scan_results ADD CONSTRAINT document_scan_results_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.lead_documents(id);
ALTER TABLE public.document_versions ADD CONSTRAINT document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.lead_documents(id);
ALTER TABLE public.email_campaign_recipients ADD CONSTRAINT email_campaign_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.email_campaigns(id);
ALTER TABLE public.email_campaign_recipients ADD CONSTRAINT email_campaign_recipients_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);
ALTER TABLE public.email_campaign_recipients ADD CONSTRAINT email_campaign_recipients_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);
ALTER TABLE public.encrypted_fields ADD CONSTRAINT fk_encryption_key FOREIGN KEY (encryption_key_id) REFERENCES public.encryption_keys(id);
ALTER TABLE public.entity_memberships ADD CONSTRAINT entity_memberships_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.business_entities(id);
ALTER TABLE public.event_attendees ADD CONSTRAINT event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);
ALTER TABLE public.forecasts ADD CONSTRAINT forecasts_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.forecast_periods(id);
ALTER TABLE public.integration_logs ADD CONSTRAINT integration_logs_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.integration_connections(id);
ALTER TABLE public.lead_scores ADD CONSTRAINT lead_scores_scoring_model_id_fkey FOREIGN KEY (scoring_model_id) REFERENCES public.lead_scoring_models(id);
ALTER TABLE public.lender_contacts ADD CONSTRAINT lender_contacts_lender_id_fkey FOREIGN KEY (lender_id) REFERENCES public.lenders(id);
ALTER TABLE public.loan_requests ADD CONSTRAINT loan_requests_lender_id_fkey FOREIGN KEY (lender_id) REFERENCES public.lenders(id);
ALTER TABLE public.opportunity_splits ADD CONSTRAINT opportunity_splits_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id);
ALTER TABLE public.partner_submissions ADD CONSTRAINT partner_submissions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.partner_organizations(id);
ALTER TABLE public.partner_users ADD CONSTRAINT partner_users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.partner_organizations(id);
ALTER TABLE public.report_execution_logs ADD CONSTRAINT report_execution_logs_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.saved_reports(id);
ALTER TABLE public.report_schedules ADD CONSTRAINT report_schedules_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.saved_reports(id);
ALTER TABLE public.report_subscriptions ADD CONSTRAINT report_subscriptions_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.saved_reports(id);
ALTER TABLE public.ringcentral_encrypted_fields ADD CONSTRAINT ringcentral_encrypted_fields_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.ringcentral_accounts(id);
ALTER TABLE public.sla_tracking ADD CONSTRAINT sla_tracking_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.sla_policies(id);
ALTER TABLE public.territory_assignments ADD CONSTRAINT territory_assignments_territory_id_fkey FOREIGN KEY (territory_id) REFERENCES public.territories(id);
ALTER TABLE public.workflow_executions ADD CONSTRAINT workflow_executions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id);

-- =====================
-- INDEXES
-- =====================
CREATE INDEX idx_account_lockouts_email_active ON public.account_lockouts USING btree (email, is_active, unlock_at);
CREATE INDEX idx_active_sessions_expires_at ON public.active_sessions USING btree (expires_at);
CREATE INDEX idx_active_sessions_is_active ON public.active_sessions USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_active_sessions_user_id ON public.active_sessions USING btree (user_id);
CREATE INDEX idx_api_analytics_bot_suspected ON public.api_request_analytics USING btree (is_bot_suspected) WHERE (is_bot_suspected = true);
CREATE INDEX idx_escalations_application ON public.application_escalations USING btree (application_id);
CREATE INDEX idx_escalations_escalated_to ON public.application_escalations USING btree (escalated_to);
CREATE INDEX idx_escalations_status ON public.application_escalations USING btree (status);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs USING btree (table_name);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);
CREATE INDEX idx_blockchain_records_record_type_id ON public.blockchain_records USING btree (record_type, record_id);
CREATE INDEX idx_blockchain_records_verification_status ON public.blockchain_records USING btree (verification_status);
CREATE INDEX idx_case_comments_case_id ON public.case_comments USING btree (case_id);
CREATE INDEX idx_cases_client_id ON public.cases USING btree (client_id);
CREATE INDEX idx_cases_created_at ON public.cases USING btree (created_at DESC);
CREATE INDEX idx_cases_priority ON public.cases USING btree (priority);
CREATE INDEX idx_cases_status ON public.cases USING btree (status);
CREATE INDEX idx_cases_user_id ON public.cases USING btree (user_id);
CREATE INDEX idx_clients_created_at ON public.clients USING btree (created_at DESC);
CREATE INDEX idx_clients_status ON public.clients USING btree (status);
CREATE INDEX idx_clients_user_id ON public.clients USING btree (user_id);
CREATE INDEX idx_clients_user_status ON public.clients USING btree (user_id, status);
CREATE UNIQUE INDEX contact_encrypted_fields_contact_id_field_name_idx ON public.contact_encrypted_fields USING btree (contact_id, field_name);
CREATE INDEX idx_contact_entities_business_name ON public.contact_entities USING btree (business_name);
CREATE INDEX idx_contact_entities_created_at ON public.contact_entities USING btree (created_at DESC);
CREATE INDEX idx_contact_entities_email ON public.contact_entities USING btree (email);
CREATE INDEX idx_contact_entities_escrow_company ON public.contact_entities USING btree (escrow_company_id);
CREATE INDEX idx_contact_entities_lender_id ON public.contact_entities USING btree (lender_id);
CREATE INDEX idx_contact_entities_priority ON public.contact_entities USING btree (priority);
CREATE INDEX idx_contact_entities_stage ON public.contact_entities USING btree (stage);
CREATE INDEX idx_contact_entities_title_company ON public.contact_entities USING btree (title_company_id);
CREATE INDEX idx_contact_entities_user_id ON public.contact_entities USING btree (user_id);
CREATE INDEX idx_contact_entities_user_stage ON public.contact_entities USING btree (user_id, stage);
CREATE INDEX idx_data_import_jobs_status ON public.data_import_jobs USING btree (status);
CREATE INDEX idx_data_import_jobs_user_id ON public.data_import_jobs USING btree (user_id);
CREATE INDEX idx_data_integrity_checks_table_status ON public.data_integrity_checks USING btree (table_name, status);
CREATE UNIQUE INDEX device_fingerprints_fingerprint_hash_unique ON public.device_fingerprints USING btree (fingerprint_hash);
CREATE INDEX idx_device_fingerprints_fingerprint_hash ON public.device_fingerprints USING btree (fingerprint_hash);
CREATE INDEX idx_device_fingerprints_suspicious ON public.device_fingerprints USING btree (is_suspicious) WHERE (is_suspicious = true);
CREATE INDEX idx_device_fingerprints_user_id ON public.device_fingerprints USING btree (user_id);
CREATE INDEX idx_document_analytics_created_at ON public.document_analytics USING btree (created_at);
CREATE INDEX idx_document_analytics_document_id ON public.document_analytics USING btree (document_id);
CREATE INDEX idx_document_analytics_user_id ON public.document_analytics USING btree (user_id);
CREATE INDEX idx_document_error_logs_created_at ON public.document_error_logs USING btree (created_at);
CREATE INDEX idx_document_error_logs_user_id ON public.document_error_logs USING btree (user_id);
CREATE INDEX idx_document_scan_results_file_hash ON public.document_scan_results USING btree (file_hash);
CREATE INDEX idx_document_scan_results_scanned_at ON public.document_scan_results USING btree (scanned_at);
CREATE INDEX idx_document_templates_active ON public.document_templates USING btree (is_active);
CREATE INDEX idx_document_templates_type ON public.document_templates USING btree (template_type);
CREATE UNIQUE INDEX document_versions_unique_version ON public.document_versions USING btree (document_id, version_number);
CREATE INDEX idx_document_versions_current ON public.document_versions USING btree (document_id, is_current) WHERE (is_current = true);
CREATE INDEX idx_document_versions_document_id ON public.document_versions USING btree (document_id);
CREATE INDEX idx_email_campaign_recipients_campaign_id ON public.email_campaign_recipients USING btree (campaign_id);
CREATE INDEX idx_email_campaign_recipients_status ON public.email_campaign_recipients USING btree (status);
CREATE INDEX idx_email_campaigns_status ON public.email_campaigns USING btree (status);
CREATE INDEX idx_email_campaigns_user_id ON public.email_campaigns USING btree (user_id);
CREATE INDEX idx_encrypted_fields_table_record ON public.encrypted_fields USING btree (table_name, record_id);
CREATE INDEX idx_event_attendees_event_id ON public.event_attendees USING btree (event_id);
CREATE INDEX idx_events_start_date ON public.events USING btree (start_date);
CREATE INDEX idx_events_user_id ON public.events USING btree (user_id);
CREATE INDEX idx_failed_login_attempts_email_time ON public.failed_login_attempts USING btree (email, attempt_time);
CREATE INDEX idx_immutable_audit_trail_timestamp ON public.immutable_audit_trail USING btree (created_at);
CREATE INDEX idx_immutable_audit_trail_user_table ON public.immutable_audit_trail USING btree (user_id, table_name);
CREATE INDEX idx_knowledge_articles_category ON public.knowledge_articles USING btree (category);
CREATE INDEX idx_knowledge_articles_status ON public.knowledge_articles USING btree (status);
CREATE INDEX idx_knowledge_articles_visibility ON public.knowledge_articles USING btree (visibility);
CREATE INDEX idx_lead_documents_versions ON public.lead_documents USING btree (id, current_version);
CREATE INDEX idx_lead_scores_category ON public.lead_scores USING btree (score_category);
CREATE INDEX idx_lead_scores_lead_id ON public.lead_scores USING btree (lead_id);
CREATE INDEX idx_lead_scores_total_score ON public.lead_scores USING btree (total_score);
CREATE INDEX idx_leads_contact_entity_id ON public.leads USING btree (contact_entity_id);
CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at DESC);
CREATE INDEX idx_leads_lead_number ON public.leads USING btree (lead_number);
CREATE INDEX idx_leads_loan_originator_id ON public.leads USING btree (loan_originator_id);
CREATE INDEX idx_leads_processor_id ON public.leads USING btree (processor_id);
CREATE INDEX idx_leads_underwriter_id ON public.leads USING btree (underwriter_id);
CREATE INDEX idx_leads_user_contact ON public.leads USING btree (user_id, contact_entity_id);
CREATE INDEX idx_leads_user_id ON public.leads USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX idx_lender_contacts_is_bdo ON public.lender_contacts USING btree (is_bdo);
CREATE INDEX idx_lender_contacts_is_closer ON public.lender_contacts USING btree (is_closer);
CREATE INDEX idx_lender_contacts_is_vice_president ON public.lender_contacts USING btree (is_vice_president);
CREATE INDEX idx_lender_contacts_lender_id ON public.lender_contacts USING btree (lender_id);
CREATE INDEX idx_lenders_is_active ON public.lenders USING btree (is_active);
CREATE INDEX idx_lenders_name ON public.lenders USING btree (name);
CREATE INDEX idx_lenders_user_id ON public.lenders USING btree (user_id);
CREATE INDEX idx_loan_requests_lender_id ON public.loan_requests USING btree (lender_id);
CREATE INDEX idx_loan_stages_active ON public.loan_stages USING btree (is_active);
CREATE INDEX idx_loan_stages_order ON public.loan_stages USING btree (order_position);
CREATE INDEX idx_mfa_settings_user_id ON public.mfa_settings USING btree (user_id);
CREATE INDEX idx_notes_history_contact_id ON public.notes_history USING btree (contact_id);
CREATE INDEX idx_notes_history_created_at ON public.notes_history USING btree (created_at DESC);
CREATE INDEX idx_notifications_scheduled_for ON public.notifications USING btree (scheduled_for);
CREATE INDEX idx_notifications_user_scheduled ON public.notifications USING btree (user_id, scheduled_for) WHERE (scheduled_for IS NOT NULL);
CREATE INDEX idx_password_history_user_id ON public.password_history USING btree (user_id);
CREATE INDEX idx_profiles_city ON public.profiles USING btree (city);
CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);
CREATE INDEX idx_profiles_state ON public.profiles USING btree (state);
CREATE INDEX idx_rate_limits_identifier ON public.rate_limits USING btree (identifier, action_type);
CREATE INDEX idx_rate_limits_identifier_action ON public.rate_limits USING btree (identifier, action_type);
CREATE INDEX idx_secure_session_expires ON public.secure_session_data USING btree (expires_at) WHERE (expires_at IS NOT NULL);
CREATE INDEX idx_secure_sessions_expires ON public.secure_sessions USING btree (expires_at);
CREATE INDEX idx_secure_sessions_risk ON public.secure_sessions USING btree (risk_score) WHERE (risk_score > 50);
CREATE INDEX idx_secure_sessions_token ON public.secure_sessions USING btree (session_token);
CREATE INDEX idx_secure_sessions_user_id ON public.secure_sessions USING btree (user_id);
CREATE INDEX idx_security_alerts_severity_created ON public.security_alerts USING btree (severity, created_at);
CREATE INDEX idx_security_events_created_at ON public.security_events USING btree (created_at DESC);
CREATE INDEX idx_security_events_event_type ON public.security_events USING btree (event_type);
CREATE INDEX idx_security_events_severity ON public.security_events USING btree (severity);
CREATE INDEX idx_security_events_user_id ON public.security_events USING btree (user_id);
CREATE INDEX idx_security_events_user_id_time ON public.security_events USING btree (user_id, created_at);
CREATE INDEX idx_security_events_user_severity ON public.security_events USING btree (user_id, severity, created_at DESC);
CREATE INDEX idx_security_notifications_unread ON public.security_notifications USING btree (user_id, is_read);
CREATE INDEX idx_security_notifications_user_id ON public.security_notifications USING btree (user_id);
CREATE INDEX idx_sensitive_access_logs_admin_time ON public.sensitive_data_access_logs USING btree (admin_user_id, created_at);
CREATE INDEX idx_sensitive_access_logs_target_time ON public.sensitive_data_access_logs USING btree (target_user_id, created_at);
CREATE INDEX idx_sensitive_permissions_active ON public.sensitive_data_permissions USING btree (is_active, expires_at);
CREATE INDEX idx_sensitive_permissions_admin_target ON public.sensitive_data_permissions USING btree (admin_user_id, target_user_id, permission_type);
CREATE INDEX idx_service_providers_active ON public.service_providers USING btree (is_active);
CREATE INDEX idx_service_providers_is_active ON public.service_providers USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_service_providers_name ON public.service_providers USING btree (name);
CREATE INDEX idx_service_providers_provider_type ON public.service_providers USING btree (provider_type);
CREATE INDEX idx_service_providers_service_areas ON public.service_providers USING gin (service_areas);
CREATE INDEX idx_service_providers_type ON public.service_providers USING btree (provider_type);
CREATE INDEX idx_session_activity_session ON public.session_activity_log USING btree (session_id);
CREATE INDEX idx_session_activity_type ON public.session_activity_log USING btree (activity_type);
CREATE INDEX idx_session_activity_user_time ON public.session_activity_log USING btree (user_id, "timestamp");
CREATE INDEX idx_session_anomalies_user_created ON public.session_anomalies USING btree (user_id, created_at);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets USING btree (created_at DESC);
CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status);
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets USING btree (user_id);
CREATE INDEX idx_task_assignments_assigned_to ON public.task_assignments USING btree (assigned_to);
CREATE INDEX idx_task_assignments_related_entity ON public.task_assignments USING btree (related_entity_id, related_entity_type);
CREATE INDEX idx_task_assignments_status ON public.task_assignments USING btree (status);
CREATE INDEX idx_threat_incidents_severity ON public.threat_incidents USING btree (severity) WHERE (severity = ANY (ARRAY['high'::text, 'critical'::text]));
CREATE INDEX idx_behavior_patterns_user_session ON public.user_behavior_patterns USING btree (user_id, session_id);
CREATE INDEX idx_user_messages_recipient ON public.user_messages USING btree (recipient_id, created_at DESC);
CREATE INDEX idx_user_messages_sender ON public.user_messages USING btree (sender_id, created_at DESC);
CREATE INDEX idx_user_messages_unread ON public.user_messages USING btree (recipient_id, is_read) WHERE (is_read = false);
CREATE INDEX idx_user_mfa_status_user_id ON public.user_mfa_status USING btree (user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role);
CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);
CREATE INDEX idx_user_roles_user_id_active ON public.user_roles USING btree (user_id, is_active) WHERE (is_active = true);
CREATE INDEX idx_user_roles_user_role ON public.user_roles USING btree (user_id, role);
CREATE INDEX idx_user_sessions_user_id_active ON public.user_sessions USING btree (user_id, is_active, expires_at);
