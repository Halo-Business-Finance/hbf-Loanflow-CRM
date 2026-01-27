-- =====================================================
-- FIX: Add search_path to test user functions
-- =====================================================

-- Re-create functions with proper search_path
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
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
BEGIN
  v_user_id := gen_random_uuid();
  
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    v_user_id,
    p_email,
    COALESCE(p_full_name, initcap(p_role) || ' User'),
    NULL
  )
  ON CONFLICT (email) DO UPDATE
  SET full_name = COALESCE(p_full_name, initcap(p_role) || ' User')
  RETURNING id INTO v_profile_id;
  
  INSERT INTO public.user_roles (user_id, role, assigned_by, assigned_at)
  VALUES (
    v_profile_id,
    p_role::public.app_role,
    auth.uid(),
    now()
  )
  ON CONFLICT (user_id, role) DO NOTHING;
  
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

CREATE OR REPLACE FUNCTION create_all_test_users()
RETURNS TABLE(
  user_id uuid,
  email text,
  role text,
  full_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH test_users AS (
    SELECT * FROM public.create_test_user('super_admin', 'admin@test.com', 'Super Admin Test')
    UNION ALL
    SELECT * FROM public.create_test_user('admin', 'manager@test.com', 'Admin Manager Test')
    UNION ALL
    SELECT * FROM public.create_test_user('agent', 'agent@test.com', 'Agent Test')
    UNION ALL
    SELECT * FROM public.create_test_user('loan_processor', 'processor@test.com', 'Loan Processor Test')
    UNION ALL
    SELECT * FROM public.create_test_user('underwriter', 'underwriter@test.com', 'Underwriter Test')
    UNION ALL
    SELECT * FROM public.create_test_user('loan_closer', 'closer@test.com', 'Loan Closer Test')
  )
  SELECT 
    tu.user_id,
    tu.email,
    tu.role,
    split_part(tu.instructions, 'email: ', 2) as full_name
  FROM test_users tu;
END;
$$;

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
SET search_path = public
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
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.email LIKE '%@test.com'
  GROUP BY p.id, p.email;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_test_users()
RETURNS TABLE(
  deleted_count integer,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_roles integer;
  v_deleted_profiles integer;
BEGIN
  WITH deleted_roles AS (
    DELETE FROM public.user_roles
    WHERE user_id IN (
      SELECT id FROM public.profiles WHERE email LIKE '%@test.com'
    )
    RETURNING *
  )
  SELECT count(*) INTO v_deleted_roles FROM deleted_roles;
  
  WITH deleted_profiles AS (
    DELETE FROM public.profiles
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