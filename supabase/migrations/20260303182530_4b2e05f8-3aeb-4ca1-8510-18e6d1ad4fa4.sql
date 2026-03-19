
-- Drop the FK constraint so admins can assign roles to pre-created profiles
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
