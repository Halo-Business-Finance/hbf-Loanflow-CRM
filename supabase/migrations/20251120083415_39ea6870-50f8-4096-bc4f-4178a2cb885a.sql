-- Add lender_id column to loan_requests table
ALTER TABLE public.loan_requests 
ADD COLUMN lender_id UUID REFERENCES public.lenders(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_loan_requests_lender_id ON public.loan_requests(lender_id);

-- Add comment for documentation
COMMENT ON COLUMN public.loan_requests.lender_id IS 'Reference to the lender handling this loan request';