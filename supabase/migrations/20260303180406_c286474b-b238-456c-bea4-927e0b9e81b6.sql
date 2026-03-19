
-- Drop the FK constraint so admins can create profiles for users who haven't signed up yet
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
