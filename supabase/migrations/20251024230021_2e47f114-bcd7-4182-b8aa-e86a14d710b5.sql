-- Ensure all app-referenced columns exist on contact_entities
ALTER TABLE contact_entities
  ADD COLUMN IF NOT EXISTS tax_id TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS years_in_business INTEGER,
  ADD COLUMN IF NOT EXISTS employees INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_revenue NUMERIC,
  ADD COLUMN IF NOT EXISTS debt_to_income_ratio NUMERIC,
  ADD COLUMN IF NOT EXISTS collateral_value NUMERIC,
  ADD COLUMN IF NOT EXISTS requested_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS purpose_of_loan TEXT,
  ADD COLUMN IF NOT EXISTS time_in_business TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS social_media TEXT,
  ADD COLUMN IF NOT EXISTS referral_source TEXT,
  ADD COLUMN IF NOT EXISTS campaign_source TEXT,
  ADD COLUMN IF NOT EXISTS lead_score INTEGER,
  ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS next_follow_up TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS conversion_probability NUMERIC;

-- Helpful indexes for common filters
CREATE INDEX IF NOT EXISTS idx_contact_entities_stage ON contact_entities(stage);
CREATE INDEX IF NOT EXISTS idx_contact_entities_priority ON contact_entities(priority);
CREATE INDEX IF NOT EXISTS idx_contact_entities_business_name ON contact_entities(business_name);

-- Keep realtime robust
ALTER TABLE contact_entities REPLICA IDENTITY FULL;