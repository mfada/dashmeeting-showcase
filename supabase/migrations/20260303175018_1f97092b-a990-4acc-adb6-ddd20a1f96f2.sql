
-- Drop the redundant restrictive policy
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

-- Recreate admin insert as PERMISSIVE
DROP POLICY IF EXISTS "Admins insert profiles" ON public.profiles;
CREATE POLICY "Admins insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (is_admin() OR (auth.uid() = id));
