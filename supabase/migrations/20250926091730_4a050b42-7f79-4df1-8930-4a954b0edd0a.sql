-- Add CRM-specific roles for existing users to demonstrate the role system

-- First, let's add some diverse CRM roles for the existing users
-- Keep the super admin roles but add appropriate CRM roles

-- User: varda@halobusinessfinance.com (keep as super_admin, add manager role)
INSERT INTO user_roles (user_id, role) 
SELECT 'd6449078-92a1-4959-96b5-9e647246d1e9', 'manager'::user_role
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = 'd6449078-92a1-4959-96b5-9e647246d1e9' AND role = 'manager'
);

-- User: varda.dinkha@halobusinessfinance.com (keep as super_admin, add loan_processor role)  
INSERT INTO user_roles (user_id, role)
SELECT '59413e39-7096-4640-9435-a0b48dcdcf90', 'loan_processor'::user_role
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = '59413e39-7096-4640-9435-a0b48dcdcf90' AND role = 'loan_processor'
);

-- User: nuri@halobusinessfinance.com (change from viewer to underwriter, keep agent as backup)
INSERT INTO user_roles (user_id, role)
SELECT '19ac8084-9306-4d50-bee2-b6eb4e7e247b', 'underwriter'::user_role
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = '19ac8084-9306-4d50-bee2-b6eb4e7e247b' AND role = 'underwriter'
);

-- Add a funder role for one of the users
INSERT INTO user_roles (user_id, role)
SELECT 'd6449078-92a1-4959-96b5-9e647246d1e9', 'funder'::user_role
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = 'd6449078-92a1-4959-96b5-9e647246d1e9' AND role = 'funder'
);

-- Add a closer role for one of the users
INSERT INTO user_roles (user_id, role)
SELECT '59413e39-7096-4640-9435-a0b48dcdcf90', 'closer'::user_role
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = '59413e39-7096-4640-9435-a0b48dcdcf90' AND role = 'closer'
);

-- Add loan_originator role for one of the users
INSERT INTO user_roles (user_id, role)
SELECT '19ac8084-9306-4d50-bee2-b6eb4e7e247b', 'loan_originator'::user_role
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = '19ac8084-9306-4d50-bee2-b6eb4e7e247b' AND role = 'loan_originator'
);

-- Clean up old viewer role that's not needed
UPDATE user_roles 
SET is_active = false 
WHERE user_id = '19ac8084-9306-4d50-bee2-b6eb4e7e247b' 
AND role = 'viewer';

-- Log the role assignments for audit
INSERT INTO audit_logs (action, table_name, new_values)
VALUES (
  'crm_roles_added',
  'user_roles',
  jsonb_build_object(
    'roles_added', ARRAY['manager', 'loan_processor', 'underwriter', 'funder', 'closer', 'loan_originator'],
    'description', 'Added CRM-specific roles to demonstrate role system',
    'timestamp', now()
  )
);