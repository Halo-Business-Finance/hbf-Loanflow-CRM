-- Users table for credential-based authentication
-- Run this migration against your IBM PostgreSQL database

CREATE TABLE IF NOT EXISTS users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT UNIQUE NOT NULL,
  password_hash        TEXT NOT NULL,
  first_name           TEXT DEFAULT '',
  last_name            TEXT DEFAULT '',
  display_name         TEXT DEFAULT '',
  roles                JSONB DEFAULT '["viewer"]'::jsonb,
  email_verified       BOOLEAN DEFAULT false,
  reset_token          TEXT,
  reset_token_expires  TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users (reset_token) WHERE reset_token IS NOT NULL;
