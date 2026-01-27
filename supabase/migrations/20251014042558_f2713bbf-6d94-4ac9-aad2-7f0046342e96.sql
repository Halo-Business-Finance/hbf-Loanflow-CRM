-- Add city and state fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text;

-- Add index for city and state for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_state ON public.profiles(state);

-- Log the schema update
COMMENT ON COLUMN public.profiles.city IS 'User city location';
COMMENT ON COLUMN public.profiles.state IS 'User state location';