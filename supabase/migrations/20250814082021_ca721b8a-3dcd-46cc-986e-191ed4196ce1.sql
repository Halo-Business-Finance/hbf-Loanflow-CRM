-- Check if you already have a user_roles table and appropriate roles
DO $$
BEGIN
    -- First, ensure we have the user_role enum type
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('tech', 'closer', 'underwriter', 'funder', 'loan_processor', 'loan_originator', 'agent', 'manager', 'admin', 'super_admin');
    END IF;

    -- Create user_roles table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_roles' AND schemaname = 'public') THEN
        CREATE TABLE public.user_roles (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            role user_role NOT NULL,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now(),
            UNIQUE(user_id, role)
        );

        -- Enable RLS
        ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

        -- Create policies
        CREATE POLICY "Users can view their own roles" ON public.user_roles
            FOR SELECT USING (auth.uid() = user_id);

        CREATE POLICY "Super admins can manage all roles" ON public.user_roles
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.user_roles ur 
                    WHERE ur.user_id = auth.uid() 
                    AND ur.role = 'super_admin'
                )
            );

        CREATE POLICY "System can insert initial roles" ON public.user_roles
            FOR INSERT WITH CHECK (true);
    END IF;

    -- Create the get_user_role function if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_role') THEN
        CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
        RETURNS text
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        AS $$
            SELECT role::text 
            FROM public.user_roles 
            WHERE user_id = p_user_id 
            ORDER BY 
                CASE role
                    WHEN 'super_admin' THEN 10
                    WHEN 'admin' THEN 9
                    WHEN 'manager' THEN 8
                    WHEN 'agent' THEN 7
                    WHEN 'loan_originator' THEN 6
                    WHEN 'loan_processor' THEN 5
                    WHEN 'funder' THEN 4
                    WHEN 'underwriter' THEN 3
                    WHEN 'closer' THEN 2
                    WHEN 'tech' THEN 1
                    ELSE 0
                END DESC
            LIMIT 1;
        $$;
    END IF;
END $$;

-- Now assign super_admin role to the current user (you, the owner)
INSERT INTO public.user_roles (user_id, role)
SELECT auth.uid(), 'super_admin'::user_role
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;