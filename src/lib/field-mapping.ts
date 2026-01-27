
import { Lead, Client, ContactEntity } from "@/types/lead"

/**
 * Maps contact entity fields to lead object for consistent access
 */
export function mapLeadFields(lead: any): Lead {
  const mappedLead: Lead = {
    ...lead,
    // Preserve lead_number
    lead_number: lead.lead_number,
    // Map contact entity fields to lead for convenience
    name: lead.contact_entity?.name || lead.name || '',
    email: lead.contact_entity?.email || lead.email || '',
    phone: lead.contact_entity?.phone || lead.phone || '',
    location: lead.contact_entity?.location || lead.location || '',
    business_name: lead.contact_entity?.business_name || lead.business_name || '',
    business_address: lead.contact_entity?.business_address || lead.business_address || '',
    business_city: lead.contact_entity?.business_city || lead.business_city || '',
    business_state: lead.contact_entity?.business_state || lead.business_state || '',
    business_zip_code: lead.contact_entity?.business_zip_code || lead.business_zip_code || '',
    home_address: lead.contact_entity?.home_address || lead.home_address || '',
    home_city: lead.contact_entity?.home_city || lead.home_city || '',
    home_state: lead.contact_entity?.home_state || lead.home_state || '',
    home_zip_code: lead.contact_entity?.home_zip_code || lead.home_zip_code || '',
    naics_code: lead.contact_entity?.naics_code || lead.naics_code || '',
    ownership_structure: lead.contact_entity?.ownership_structure || lead.ownership_structure || '',
    owns_property: lead.contact_entity?.owns_property ?? lead.owns_property ?? false,
    property_payment_amount: lead.contact_entity?.property_payment_amount ?? lead.property_payment_amount ?? 0,
    year_established: lead.contact_entity?.year_established ?? lead.year_established,
    loan_amount: lead.contact_entity?.loan_amount ?? lead.loan_amount ?? 0,
    loan_type: lead.contact_entity?.loan_type || lead.loan_type || '',
    stage: lead.contact_entity?.stage || lead.stage || 'New',
    priority: lead.contact_entity?.priority || lead.priority || 'medium',
    credit_score: lead.contact_entity?.credit_score ?? lead.credit_score,
    net_operating_income: lead.contact_entity?.net_operating_income ?? lead.net_operating_income,
    bank_lender_name: lead.contact_entity?.bank_lender_name || lead.bank_lender_name || '',
    annual_revenue: lead.contact_entity?.annual_revenue ?? lead.annual_revenue,
    interest_rate: lead.contact_entity?.interest_rate ?? lead.interest_rate,
    maturity_date: lead.contact_entity?.maturity_date || lead.maturity_date || '',
    existing_loan_amount: lead.contact_entity?.existing_loan_amount ?? lead.existing_loan_amount,
    notes: lead.contact_entity?.notes || lead.notes || '',
    call_notes: lead.contact_entity?.call_notes || lead.call_notes || '',
    income: lead.contact_entity?.income ?? lead.income,
    bdo_name: lead.contact_entity?.bdo_name || lead.bdo_name || '',
    bdo_telephone: lead.contact_entity?.bdo_telephone || lead.bdo_telephone || '',
    bdo_email: lead.contact_entity?.bdo_email || lead.bdo_email || '',
    // Additional fields that might be missing
    source: lead.contact_entity?.source || lead.source || '',
    tax_id: lead.contact_entity?.tax_id || lead.tax_id || '',
    business_type: lead.contact_entity?.business_type || lead.business_type || '',
    years_in_business: lead.contact_entity?.years_in_business ?? lead.years_in_business,
    employees: lead.contact_entity?.employees ?? lead.employees,
    monthly_revenue: lead.contact_entity?.monthly_revenue ?? lead.monthly_revenue,
    debt_to_income_ratio: lead.contact_entity?.debt_to_income_ratio ?? lead.debt_to_income_ratio,
    collateral_value: lead.contact_entity?.collateral_value ?? lead.collateral_value,
    requested_amount: lead.contact_entity?.requested_amount ?? lead.requested_amount,
    purpose_of_loan: lead.contact_entity?.purpose_of_loan || lead.purpose_of_loan || '',
    time_in_business: lead.contact_entity?.time_in_business || lead.time_in_business || '',
    industry: lead.contact_entity?.industry || lead.industry || '',
    website: lead.contact_entity?.website || lead.website || '',
    social_media: lead.contact_entity?.social_media || lead.social_media || '',
    referral_source: lead.contact_entity?.referral_source || lead.referral_source || '',
    campaign_source: lead.contact_entity?.campaign_source || lead.campaign_source || '',
    lead_score: lead.contact_entity?.lead_score ?? lead.lead_score,
    last_activity: lead.contact_entity?.last_activity || lead.last_activity || '',
    next_follow_up: lead.contact_entity?.next_follow_up || lead.next_follow_up || '',
    conversion_probability: lead.contact_entity?.conversion_probability ?? lead.conversion_probability
  }
  
  return mappedLead
}

/**
 * Maps contact entity fields to client object for consistent access
 */
export function mapClientFields(client: any): Client {
  const mappedClient: Client = {
    ...client,
    // Map contact entity fields to client for convenience
    name: client.contact_entity?.name || client.name || '',
    email: client.contact_entity?.email || client.email || '',
    phone: client.contact_entity?.phone || client.phone || '',
    location: client.contact_entity?.location || client.location || '',
    business_name: client.contact_entity?.business_name || client.business_name || '',
    // Additional client-specific fields
    business_address: client.contact_entity?.business_address || client.business_address || '',
    tax_id: client.contact_entity?.tax_id || client.tax_id || '',
    business_type: client.contact_entity?.business_type || client.business_type || '',
    industry: client.contact_entity?.industry || client.industry || '',
    website: client.contact_entity?.website || client.website || '',
    annual_revenue: client.contact_entity?.annual_revenue ?? client.annual_revenue,
    employees: client.contact_entity?.employees ?? client.employees,
    years_in_business: client.contact_entity?.years_in_business ?? client.years_in_business,
    loan_amount: client.contact_entity?.loan_amount ?? client.loan_amount ?? 0,
    loan_type: client.contact_entity?.loan_type || client.loan_type || '',
    interest_rate: client.contact_entity?.interest_rate ?? client.interest_rate,
    maturity_date: client.contact_entity?.maturity_date || client.maturity_date || '',
    credit_score: client.contact_entity?.credit_score ?? client.credit_score
  }
  
  return mappedClient
}

/**
 * Extracts contact entity data from lead/client for database operations
 */
export function extractContactEntityData(data: any): Partial<ContactEntity> {
  return {
    name: data.name,
    email: data.email,
    phone: data.phone,
    location: data.location,
    business_name: data.business_name,
    business_address: data.business_address,
    home_address: data.home_address,
    home_city: data.home_city,
    home_state: data.home_state,
    home_zip_code: data.home_zip_code,
    naics_code: data.naics_code,
    ownership_structure: data.ownership_structure,
    owns_property: data.owns_property,
    property_payment_amount: data.property_payment_amount,
    year_established: data.year_established,
    loan_amount: data.loan_amount,
    loan_type: data.loan_type,
    stage: data.stage,
    priority: data.priority,
    credit_score: data.credit_score,
    net_operating_income: data.net_operating_income,
    annual_revenue: data.annual_revenue,
    interest_rate: data.interest_rate,
    maturity_date: data.maturity_date,
    existing_loan_amount: data.existing_loan_amount,
    notes: data.notes,
    call_notes: data.call_notes,
    income: data.income,
    bdo_name: data.bdo_name,
    bdo_telephone: data.bdo_telephone,
    bdo_email: data.bdo_email,
    // Additional fields
    source: data.source,
    tax_id: data.tax_id,
    business_type: data.business_type,
    years_in_business: data.years_in_business,
    employees: data.employees,
    monthly_revenue: data.monthly_revenue,
    debt_to_income_ratio: data.debt_to_income_ratio,
    collateral_value: data.collateral_value,
    requested_amount: data.requested_amount,
    purpose_of_loan: data.purpose_of_loan,
    time_in_business: data.time_in_business,
    industry: data.industry,
    website: data.website,
    social_media: data.social_media,
    referral_source: data.referral_source,
    campaign_source: data.campaign_source,
    lead_score: data.lead_score,
    last_activity: data.last_activity,
    next_follow_up: data.next_follow_up,
    conversion_probability: data.conversion_probability
  }
}

/**
 * Standard query fragment for fetching leads with contact entities
 */
export const LEAD_WITH_CONTACT_QUERY = `
  *,
  contact_entity:contact_entities!contact_entity_id (*)
`

/**
 * Standard query fragment for fetching clients with contact entities
 */
export const CLIENT_WITH_CONTACT_QUERY = `
  *,
  contact_entity:contact_entities!contact_entity_id (*)
`

/**
 * Complete field definitions for form validation and display
 */
export const LEAD_FIELD_DEFINITIONS = {
  // Basic Information
  name: { label: 'Full Name', type: 'text', required: true, category: 'basic' },
  email: { label: 'Email Address', type: 'email', required: true, category: 'basic' },
  phone: { label: 'Phone Number', type: 'tel', required: true, category: 'basic' },
  location: { label: 'Location', type: 'text', required: false, category: 'basic' },
  
  // Business Information
  business_name: { label: 'Business Name', type: 'text', required: false, category: 'business' },
  business_address: { label: 'Business Address', type: 'text', required: false, category: 'business' },
  business_type: { label: 'Business Type', type: 'select', required: false, category: 'business' },
  industry: { label: 'Industry', type: 'text', required: false, category: 'business' },
  naics_code: { label: 'NAICS Code', type: 'text', required: false, category: 'business' },
  tax_id: { label: 'Tax ID/EIN', type: 'text', required: false, category: 'business' },
  website: { label: 'Website', type: 'url', required: false, category: 'business' },
  ownership_structure: { label: 'Ownership Structure', type: 'select', required: false, category: 'business' },
  year_established: { label: 'Year Established', type: 'number', required: false, category: 'business' },
  years_in_business: { label: 'Years in Business', type: 'number', required: false, category: 'business' },
  time_in_business: { label: 'Time in Business', type: 'text', required: false, category: 'business' },
  employees: { label: 'Number of Employees', type: 'number', required: false, category: 'business' },
  
  // Financial Information
  loan_amount: { label: 'Loan Amount', type: 'currency', required: false, category: 'financial' },
  requested_amount: { label: 'Requested Amount', type: 'currency', required: false, category: 'financial' },
  loan_type: { label: 'Loan Type', type: 'select', required: false, category: 'financial' },
  purpose_of_loan: { label: 'Purpose of Loan', type: 'textarea', required: false, category: 'financial' },
  annual_revenue: { label: 'Annual Revenue', type: 'currency', required: false, category: 'financial' },
  monthly_revenue: { label: 'Monthly Revenue', type: 'currency', required: false, category: 'financial' },
  net_operating_income: { label: 'Net Operating Income', type: 'currency', required: false, category: 'financial' },
  income: { label: 'Income', type: 'currency', required: false, category: 'financial' },
  credit_score: { label: 'Credit Score', type: 'number', required: false, category: 'financial' },
  debt_to_income_ratio: { label: 'Debt to Income Ratio', type: 'percentage', required: false, category: 'financial' },
  collateral_value: { label: 'Collateral Value', type: 'currency', required: false, category: 'financial' },
  existing_loan_amount: { label: 'Existing Loan Amount', type: 'currency', required: false, category: 'financial' },
  interest_rate: { label: 'Interest Rate', type: 'percentage', required: false, category: 'financial' },
  maturity_date: { label: 'Maturity Date', type: 'date', required: false, category: 'financial' },
  
  // Property Information
  owns_property: { label: 'Owns Property', type: 'boolean', required: false, category: 'property' },
  property_payment_amount: { label: 'Property Payment Amount', type: 'currency', required: false, category: 'property' },
  
  // Bank/Lender Information
  bank_lender_name: { label: 'Bank/Lender Name', type: 'text', required: false, category: 'banking' },
  bdo_name: { label: 'BDO Name', type: 'text', required: false, category: 'banking' },
  bdo_telephone: { label: 'BDO Telephone', type: 'tel', required: false, category: 'banking' },
  bdo_email: { label: 'BDO Email', type: 'email', required: false, category: 'banking' },
  
  // Lead Management
  stage: { label: 'Stage', type: 'select', required: false, category: 'management' },
  priority: { label: 'Priority', type: 'select', required: false, category: 'management' },
  source: { label: 'Lead Source', type: 'text', required: false, category: 'management' },
  referral_source: { label: 'Referral Source', type: 'text', required: false, category: 'management' },
  campaign_source: { label: 'Campaign Source', type: 'text', required: false, category: 'management' },
  lead_score: { label: 'Lead Score', type: 'number', required: false, category: 'management' },
  conversion_probability: { label: 'Conversion Probability', type: 'percentage', required: false, category: 'management' },
  
  // Activity & Communication
  last_activity: { label: 'Last Activity', type: 'datetime', required: false, category: 'activity' },
  next_follow_up: { label: 'Next Follow Up', type: 'datetime', required: false, category: 'activity' },
  last_contact: { label: 'Last Contact', type: 'datetime', required: false, category: 'activity' },
  notes: { label: 'General Notes', type: 'textarea', required: false, category: 'activity' },
  call_notes: { label: 'Call Notes', type: 'textarea', required: false, category: 'activity' },
  
  // Social & Marketing
  social_media: { label: 'Social Media', type: 'text', required: false, category: 'marketing' }
}

/**
 * Field categories for organized display
 */
export const FIELD_CATEGORIES = {
  basic: 'Basic Information',
  business: 'Business Information', 
  financial: 'Financial Information',
  property: 'Property Information',
  banking: 'Bank/Lender Information',
  management: 'Lead Management',
  activity: 'Activity & Communication',
  marketing: 'Marketing & Social'
}

/**
 * Get fields by category for organized forms
 */
export function getFieldsByCategory(category: keyof typeof FIELD_CATEGORIES) {
  return Object.entries(LEAD_FIELD_DEFINITIONS)
    .filter(([_, config]) => config.category === category)
    .reduce((acc, [field, config]) => {
      acc[field] = config
      return acc
    }, {} as Record<string, any>)
}

/**
 * Get all field names for a category
 */
export function getFieldNamesForCategory(category: keyof typeof FIELD_CATEGORIES): string[] {
  return Object.keys(getFieldsByCategory(category))
}
