-- Deduplicate user_roles to allow ON CONFLICT (user_id, role)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, role 
           ORDER BY is_active DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, assigned_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.user_roles
)
DELETE FROM public.user_roles ur
USING ranked r
WHERE ur.id = r.id AND r.rn > 1;

-- Create unique index for (user_id, role) if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'user_roles_user_id_role_key'
  ) THEN
    CREATE UNIQUE INDEX user_roles_user_id_role_key ON public.user_roles(user_id, role);
  END IF;
END $$;

-- Make new role rows active by default
ALTER TABLE public.user_roles ALTER COLUMN is_active SET DEFAULT true;