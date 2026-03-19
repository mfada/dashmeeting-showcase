
-- Fix the permissive profiles INSERT policy - restrict to the user's own ID
DROP POLICY "System inserts profiles" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
