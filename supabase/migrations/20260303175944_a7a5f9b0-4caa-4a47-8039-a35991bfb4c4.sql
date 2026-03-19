
-- Fix: Convert restrictive insert policy to permissive so it actually allows inserts
DROP POLICY IF EXISTS "Admins insert profiles" ON public.profiles;

CREATE POLICY "Admins or self insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (is_admin() OR (auth.uid() = id));
