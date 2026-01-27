-- =====================================================
-- TEST USER CREATION HELPER FUNCTIONS
-- =====================================================

-- Function to create a test user with a specific role
-- Usage: SELECT create_test_user('agent', 'agent@test.com', 'Agent Test');
CREATE OR REPLACE FUNCTION create_test_user(
  p_role text,
  p_email text,
  p_full_name text DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid,
  email text,
  role text,
  instructions text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
BEGIN
  -- Generate a deterministic user_id based on email
  v_user_id := gen_random_uuid();
  
  -- Create profile entry (profiles table is used for additional user data)
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    v_user_id,
    p_email,
    COALESCE(p_full_name, initcap(p_role) || ' User'),
    NULL
  )
  ON CONFLICT (email) DO UPDATE
  SET full_name = COALESCE(p_full_name, initcap(p_role) || ' User')
  RETURNING id INTO v_profile_id;
  
  -- Assign role
  INSERT INTO user_roles (user_id, role, assigned_by, assigned_at)
  VALUES (
    v_profile_id,
    p_role::app_role,
    auth.uid(),
    now()
  )
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Return user details with instructions
  RETURN QUERY
  SELECT 
    v_profile_id as user_id,
    p_email as email,
    p_role as role,
    format(
      'Test user created. To activate: 1) Go to Supabase Dashboard > Authentication > Users, 2) Click "Add User", 3) Use email: %s, 4) Set a password',
      p_email
    ) as instructions;
END;
$$;

-- Function to create all standard test users at once
-- Usage: SELECT * FROM create_all_test_users();
CREATE OR REPLACE FUNCTION create_all_test_users()
RETURNS TABLE(
  user_id uuid,
  email text,
  role text,
  full_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH test_users AS (
    SELECT * FROM create_test_user('super_admin', 'admin@test.com', 'Super Admin Test')
    UNION ALL
    SELECT * FROM create_test_user('admin', 'manager@test.com', 'Admin Manager Test')
    UNION ALL
    SELECT * FROM create_test_user('agent', 'agent@test.com', 'Agent Test')
    UNION ALL
    SELECT * FROM create_test_user('loan_processor', 'processor@test.com', 'Loan Processor Test')
    UNION ALL
    SELECT * FROM create_test_user('underwriter', 'underwriter@test.com', 'Underwriter Test')
    UNION ALL
    SELECT * FROM create_test_user('loan_closer', 'closer@test.com', 'Loan Closer Test')
  )
  SELECT 
    tu.user_id,
    tu.email,
    tu.role,
    split_part(tu.instructions, 'email: ', 2) as full_name
  FROM test_users tu;
END;
$$;

-- Function to verify test user roles
-- Usage: SELECT * FROM verify_test_user_roles();
CREATE OR REPLACE FUNCTION verify_test_user_roles()
RETURNS TABLE(
  email text,
  assigned_roles text[],
  profile_exists boolean,
  auth_user_exists boolean,
  status text
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.email,
    array_agg(ur.role::text ORDER BY ur.role) as assigned_roles,
    true as profile_exists,
    EXISTS(SELECT 1 FROM auth.users au WHERE au.id = p.id) as auth_user_exists,
    CASE 
      WHEN EXISTS(SELECT 1 FROM auth.users au WHERE au.id = p.id) THEN 'Active'
      ELSE 'Profile Only - Needs Auth User Creation'
    END as status
  FROM profiles p
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  WHERE p.email LIKE '%@test.com'
  GROUP BY p.id, p.email;
END;
$$;

-- Function to clean up test users (for testing iterations)
-- Usage: SELECT cleanup_test_users();
CREATE OR REPLACE FUNCTION cleanup_test_users()
RETURNS TABLE(
  deleted_count integer,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_roles integer;
  v_deleted_profiles integer;
BEGIN
  -- Delete role assignments for test users
  WITH deleted_roles AS (
    DELETE FROM user_roles
    WHERE user_id IN (
      SELECT id FROM profiles WHERE email LIKE '%@test.com'
    )
    RETURNING *
  )
  SELECT count(*) INTO v_deleted_roles FROM deleted_roles;
  
  -- Delete profiles for test users (this won't delete auth.users)
  WITH deleted_profiles AS (
    DELETE FROM profiles
    WHERE email LIKE '%@test.com'
    RETURNING *
  )
  SELECT count(*) INTO v_deleted_profiles FROM deleted_profiles;
  
  RETURN QUERY
  SELECT 
    v_deleted_profiles as deleted_count,
    format('Deleted %s test user profiles and %s role assignments. Note: Auth users must be manually deleted from Supabase Dashboard.', 
      v_deleted_profiles, v_deleted_roles) as message;
END;
$$;

-- Log this migration
INSERT INTO audit_logs (
  user_id,
  action,
  table_name,
  new_values
) VALUES (
  auth.uid(),
  'CREATE_TEST_USER_FUNCTIONS',
  'functions',
  jsonb_build_object(
    'functions', array['create_test_user', 'create_all_test_users', 'verify_test_user_roles', 'cleanup_test_users'],
    'purpose', 'Testing and QA helper functions',
    'timestamp', now()
  )
);