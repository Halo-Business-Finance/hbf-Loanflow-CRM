-- Add team assignment columns to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS loan_originator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS processor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS underwriter_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_loan_originator_id ON leads(loan_originator_id);
CREATE INDEX IF NOT EXISTS idx_leads_processor_id ON leads(processor_id);
CREATE INDEX IF NOT EXISTS idx_leads_underwriter_id ON leads(underwriter_id);

-- Add comments for documentation
COMMENT ON COLUMN leads.loan_originator_id IS 'User assigned as the loan originator for this lead';
COMMENT ON COLUMN leads.processor_id IS 'User assigned as the processor for this lead';
COMMENT ON COLUMN leads.underwriter_id IS 'User assigned as the underwriter for this lead';