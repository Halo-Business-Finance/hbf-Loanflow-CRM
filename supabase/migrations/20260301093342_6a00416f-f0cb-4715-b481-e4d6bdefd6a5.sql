CREATE TABLE IF NOT EXISTS crm_performance_log (
  log_id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  loan_id INT,
  stage_name VARCHAR(100),
  entered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  exited_at TIMESTAMPTZ NULL,
  lead_source VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_crm_perf_log_loan ON crm_performance_log (loan_id);
CREATE INDEX IF NOT EXISTS idx_crm_perf_log_stage ON crm_performance_log (stage_name);
CREATE INDEX IF NOT EXISTS idx_crm_perf_log_source ON crm_performance_log (lead_source);