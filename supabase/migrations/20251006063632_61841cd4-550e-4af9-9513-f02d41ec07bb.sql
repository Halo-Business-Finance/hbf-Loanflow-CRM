-- Add sequential user number column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_number INTEGER;

-- Create a sequence starting at 3
CREATE SEQUENCE IF NOT EXISTS user_number_seq START 3;

-- Create function to auto-assign user numbers
CREATE OR REPLACE FUNCTION assign_user_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_number IS NULL THEN
    NEW.user_number := nextval('user_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign user numbers on insert
DROP TRIGGER IF EXISTS assign_user_number_trigger ON public.profiles;
CREATE TRIGGER assign_user_number_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION assign_user_number();

-- Assign numbers to existing users based on creation date
-- Varda (super_admin) gets 003, Nuri (underwriter) gets 004
WITH numbered_users AS (
  SELECT 
    p.id,
    ROW_NUMBER() OVER (ORDER BY p.created_at) + 2 as new_number
  FROM public.profiles p
  WHERE p.user_number IS NULL
)
UPDATE public.profiles p
SET user_number = nu.new_number
FROM numbered_users nu
WHERE p.id = nu.id;