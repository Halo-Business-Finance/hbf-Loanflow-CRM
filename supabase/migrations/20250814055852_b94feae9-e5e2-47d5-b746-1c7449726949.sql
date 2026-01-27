-- Fix medium-level data integrity issues

-- 1. Fix missing priority fields (set default to 'medium')
UPDATE contact_entities 
SET priority = 'medium' 
WHERE priority IS NULL OR priority = '';

-- 2. Fix missing stage fields (set default to 'New Lead')
UPDATE contact_entities 
SET stage = 'New Lead' 
WHERE stage IS NULL OR stage = '';

-- 3. Fix missing business names for large loans
UPDATE contact_entities 
SET business_name = CASE 
    WHEN name IS NOT NULL THEN name || ' Business'
    ELSE 'Business Entity'
END
WHERE (business_name IS NULL OR business_name = '') 
AND loan_amount > 100000;

-- 4. Fix phone number formatting (standardize 10-digit US phone numbers)
UPDATE contact_entities 
SET phone = '(' || substring(regexp_replace(phone, '\D', '', 'g'), 1, 3) || ') ' || 
           substring(regexp_replace(phone, '\D', '', 'g'), 4, 3) || '-' || 
           substring(regexp_replace(phone, '\D', '', 'g'), 7, 4)
WHERE phone IS NOT NULL 
AND phone != '' 
AND length(regexp_replace(phone, '\D', '', 'g')) = 10
AND phone !~ '^\(\d{3}\) \d{3}-\d{4}$';

-- 5. Fix pipeline entries with missing or zero amounts
UPDATE pipeline_entries 
SET amount = CASE 
    WHEN stage ILIKE '%application%' OR stage ILIKE '%qualified%' THEN 100000
    WHEN stage ILIKE '%approved%' OR stage ILIKE '%documentation%' OR stage ILIKE '%closing%' THEN 250000
    WHEN stage ILIKE '%funded%' THEN 500000
    ELSE 50000
END
WHERE amount IS NULL OR amount = 0;

-- 6. Fix pipeline entries with missing stages
UPDATE pipeline_entries 
SET stage = 'New Lead' 
WHERE stage IS NULL OR stage = '';

-- 7. Set default loan amounts for contacts without any
UPDATE contact_entities 
SET loan_amount = CASE 
    WHEN business_name IS NOT NULL AND business_name != '' THEN 100000
    ELSE 50000
END
WHERE loan_amount IS NULL;