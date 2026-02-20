-- ══════════════════════════════════════════════════════════════════
-- hbf-api: New tables for CRM integration
-- Safe to run multiple times (IF NOT EXISTS everywhere)
-- ══════════════════════════════════════════════════════════════════

-- ── Lenders ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lenders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255),
  phone         VARCHAR(50),
  contact_name  VARCHAR(200),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  lender_type   VARCHAR(100),
  status        VARCHAR(50) DEFAULT 'active',
  website       VARCHAR(500),
  address       TEXT,
  city          VARCHAR(100),
  state         VARCHAR(50),
  zip_code      VARCHAR(20),
  notes         TEXT,
  loan_types    JSONB DEFAULT '[]',
  min_loan_amount NUMERIC(15,2),
  max_loan_amount NUMERIC(15,2),
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lenders_status ON lenders (status);
CREATE INDEX IF NOT EXISTS idx_lenders_user_id ON lenders (user_id);

-- ── Clients ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL,
  contact_entity_id UUID,
  lead_id           UUID,
  status            VARCHAR(50) DEFAULT 'active',
  join_date         DATE,
  last_activity     TIMESTAMPTZ,
  total_loans       INTEGER DEFAULT 0,
  total_loan_value  NUMERIC(15,2) DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients (user_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients (status);

-- ── Service Providers ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_providers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID,
  name            VARCHAR(255) NOT NULL,
  provider_type   VARCHAR(100),
  email           VARCHAR(255),
  phone           VARCHAR(50),
  contact_name    VARCHAR(200),
  contact_email   VARCHAR(255),
  contact_phone   VARCHAR(50),
  website         VARCHAR(500),
  address         TEXT,
  city            VARCHAR(100),
  state           VARCHAR(50),
  zip_code        VARCHAR(20),
  status          VARCHAR(50) DEFAULT 'active',
  notes           TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_providers_type ON service_providers (provider_type);

-- ── Profiles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE,
  email           VARCHAR(255),
  first_name      VARCHAR(100),
  last_name       VARCHAR(100),
  display_name    VARCHAR(200),
  role            VARCHAR(50) DEFAULT 'viewer',
  department      VARCHAR(100),
  phone           VARCHAR(50),
  avatar_url      TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  preferences     JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles (user_id);

-- ── Messages ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL,
  sender_id     UUID,
  recipient_id  UUID,
  lead_id       UUID,
  subject       VARCHAR(500),
  body          TEXT,
  message_type  VARCHAR(50) DEFAULT 'internal',
  is_read       BOOLEAN DEFAULT FALSE,
  is_archived   BOOLEAN DEFAULT FALSE,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages (recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages (lead_id);

-- ── Tasks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL,
  assigned_to   UUID,
  lead_id       UUID,
  title         VARCHAR(500) NOT NULL,
  description   TEXT,
  status        VARCHAR(50) DEFAULT 'pending',
  priority      VARCHAR(50) DEFAULT 'medium',
  due_date      TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  task_type     VARCHAR(100),
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);

-- ── Lead Documents ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id         UUID,
  user_id         UUID,
  document_name   VARCHAR(500) NOT NULL,
  document_type   VARCHAR(100),
  file_path       TEXT,
  file_url        TEXT,
  file_size       BIGINT,
  mime_type       VARCHAR(100),
  status          VARCHAR(50) DEFAULT 'pending',
  notes           TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_docs_lead ON lead_documents (lead_id);

-- ── Document Templates ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  template_type   VARCHAR(100),
  content         TEXT,
  file_path       TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Document Versions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id     UUID NOT NULL,
  version_number  INTEGER DEFAULT 1,
  file_path       TEXT,
  file_url        TEXT,
  uploaded_by     UUID,
  changes_summary TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_versions_doc ON document_versions (document_id);

-- ── Email Accounts ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL,
  email_address   VARCHAR(255) NOT NULL,
  provider        VARCHAR(100),
  display_name    VARCHAR(200),
  is_active       BOOLEAN DEFAULT TRUE,
  is_default      BOOLEAN DEFAULT FALSE,
  settings        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_accts_user ON email_accounts (user_id);

-- ── Approval Requests ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id      UUID,
  submitted_by    UUID NOT NULL,
  record_id       UUID NOT NULL,
  record_type     VARCHAR(100) NOT NULL,
  status          VARCHAR(50) DEFAULT 'pending',
  current_step    INTEGER DEFAULT 0,
  comments        TEXT,
  completed_at    TIMESTAMPTZ,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_approval_req_status ON approval_requests (status);

-- ── Approval Steps ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_steps (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id      UUID NOT NULL REFERENCES approval_requests(id),
  step_number     INTEGER NOT NULL,
  approver_id     UUID NOT NULL,
  status          VARCHAR(50) DEFAULT 'pending',
  comments        TEXT,
  actioned_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_approval_steps_req ON approval_steps (request_id);
