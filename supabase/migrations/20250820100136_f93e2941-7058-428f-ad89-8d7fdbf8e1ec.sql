-- Get the current user ID and assign admin role
DO $$
DECLARE
    current_user_uuid uuid := auth.uid();
BEGIN
    -- Insert or update user role to admin
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (current_user_uuid, 'admin', true)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        role = 'admin',
        is_active = true,
        updated_at = now();
END $$;