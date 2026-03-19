-- Add UPDATE policy for meeting_participants so admins can link users
CREATE POLICY "Admins update participants"
  ON public.meeting_participants FOR UPDATE
  USING (is_admin());

-- Add admin INSERT policy for profiles (to create profiles for known users)
CREATE POLICY "Admins insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (is_admin() OR auth.uid() = id);

-- Add admin DELETE policy for profiles
CREATE POLICY "Admins delete profiles"
  ON public.profiles FOR DELETE
  USING (is_admin());

-- Add admin UPDATE policy for profiles
CREATE POLICY "Admins update profiles"
  ON public.profiles FOR UPDATE
  USING (is_admin() OR auth.uid() = id);