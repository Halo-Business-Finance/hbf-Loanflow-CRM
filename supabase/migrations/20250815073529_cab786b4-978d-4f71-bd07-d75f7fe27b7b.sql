-- Create function to get unmasked contact entity data for authorized users
CREATE OR REPLACE FUNCTION get_unmasked_contact_entity(contact_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  business_name TEXT,
  business_address TEXT,
  stage TEXT,
  priority TEXT,
  loan_amount NUMERIC,
  loan_type TEXT,
  credit_score INTEGER,
  annual_revenue NUMERIC,
  net_operating_income NUMERIC,
  notes TEXT,
  call_notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  naics_code TEXT,
  ownership_structure TEXT,
  owns_property BOOLEAN,
  property_payment_amount NUMERIC,
  year_established INTEGER,
  income NUMERIC,
  interest_rate NUMERIC,
  maturity_date DATE,
  existing_loan_amount NUMERIC,
  current_processing_rate NUMERIC,
  monthly_processing_volume NUMERIC,
  average_transaction_size NUMERIC,
  pos_system TEXT,
  processor_name TEXT,
  bank_lender_name TEXT,
  bdo_name TEXT,
  bdo_email TEXT,
  bdo_telephone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user has access to this contact entity
  IF NOT EXISTS (
    SELECT 1 FROM contact_entities ce 
    WHERE ce.id = contact_id 
    AND (
      auth.uid() = ce.user_id OR 
      has_role('admin'::user_role) OR 
      has_role('super_admin'::user_role) OR
      has_role('manager'::user_role) OR
      has_role('loan_processor'::user_role) OR
      has_role('underwriter'::user_role) OR
      has_role('funder'::user_role) OR
      has_role('closer'::user_role)
    )
  ) THEN
    RAISE EXCEPTION 'Access denied to contact entity';
  END IF;

  -- Return unmasked data by selecting from encrypted fields table and decrypting
  RETURN QUERY
  SELECT 
    ce.id,
    ce.user_id,
    ce.name,
    COALESCE(
      (SELECT decrypt_contact_field(cef.encrypted_value) 
       FROM contact_encrypted_fields cef 
       WHERE cef.contact_id = ce.id AND cef.field_name = 'email'),
      ce.email
    ) as email,
    COALESCE(
      (SELECT decrypt_contact_field(cef.encrypted_value) 
       FROM contact_encrypted_fields cef 
       WHERE cef.contact_id = ce.id AND cef.field_name = 'phone'),
      ce.phone
    ) as phone,
    ce.business_name,
    ce.business_address,
    ce.stage,
    ce.priority,
    ce.loan_amount,
    ce.loan_type,
    ce.credit_score,
    ce.annual_revenue,
    ce.net_operating_income,
    ce.notes,
    ce.call_notes,
    ce.created_at,
    ce.updated_at,
    ce.naics_code,
    ce.ownership_structure,
    ce.owns_property,
    ce.property_payment_amount,
    ce.year_established,
    ce.income,
    ce.interest_rate,
    ce.maturity_date,
    ce.existing_loan_amount,
    ce.current_processing_rate,
    ce.monthly_processing_volume,
    ce.average_transaction_size,
    ce.pos_system,
    ce.processor_name,
    ce.bank_lender_name,
    ce.bdo_name,
    ce.bdo_email,
    ce.bdo_telephone
  FROM contact_entities ce
  WHERE ce.id = contact_id;
END;
$$;