-- Create a secure admin_update_profile function to avoid RLS issues and handle column differences (phone vs phone_number)
CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_user_id uuid,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_is_admin boolean := false;
  col_phone_exists boolean := false;
  col_phone_number_exists boolean := false;
  col_is_active_exists boolean := false;
  update_sql text := 'UPDATE public.profiles SET ';
  set_parts text[] := ARRAY[]::text[];
  result_row jsonb;
BEGIN
  -- Verify the caller is authenticated and has admin privileges
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied: not authenticated';
  END IF;

  v_is_admin := public.get_user_role(auth.uid()) IN ('admin', 'super_admin');
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- Detect column presence safely
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone'
  ) INTO col_phone_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_number'
  ) INTO col_phone_number_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_active'
  ) INTO col_is_active_exists;

  -- Build dynamic SET clauses only for provided params and existing columns
  IF p_first_name IS NOT NULL THEN
    set_parts := set_parts || format('first_name = %L', p_first_name);
  END IF;

  IF p_last_name IS NOT NULL THEN
    set_parts := set_parts || format('last_name = %L', p_last_name);
  END IF;

  IF p_phone IS NOT NULL THEN
    IF col_phone_exists THEN
      set_parts := set_parts || format('phone = %L', p_phone);
    ELSIF col_phone_number_exists THEN
      set_parts := set_parts || format('phone_number = %L', p_phone);
    END IF;
  END IF;

  IF p_is_active IS NOT NULL AND col_is_active_exists THEN
    set_parts := set_parts || format('is_active = %L', p_is_active);
  END IF;

  -- Ensure there's something to update
  IF array_length(set_parts, 1) IS NULL THEN
    -- Nothing to update, just return current row
    SELECT to_jsonb(p) INTO result_row
    FROM public.profiles p
    WHERE p.id = p_user_id;

    RETURN jsonb_build_object('success', true, 'profile', result_row, 'updated', false);
  END IF;

  update_sql := update_sql || array_to_string(set_parts, ', ') || format(' WHERE id = %L RETURNING to_jsonb(profiles.*)', p_user_id);

  EXECUTE update_sql INTO result_row;

  IF result_row IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user id %', p_user_id;
  END IF;

  -- Audit log entry
  PERFORM public.create_audit_log(
    'admin_update_profile',
    'profiles',
    p_user_id::text,
    NULL,
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name,
      'phone', p_phone,
      'is_active', p_is_active,
      'updated_by', auth.uid(),
      'updated_at', now()
    )
  );

  -- Security event
  INSERT INTO public.security_events (user_id, event_type, severity, details)
  VALUES (
    auth.uid(),
    'admin_profile_update',
    'medium',
    jsonb_build_object('target_user_id', p_user_id)
  );

  RETURN jsonb_build_object('success', true, 'profile', result_row, 'updated', true);
END;
$$;