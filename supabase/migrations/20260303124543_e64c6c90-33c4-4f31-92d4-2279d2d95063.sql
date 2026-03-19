
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Create task enums
CREATE TYPE public.task_status AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE public.task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE public.import_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE public.import_source AS ENUM ('fireflies', 'file_upload');

-- 3. Profiles table (synced from auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Meetings table
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  general_summary TEXT,
  source public.import_source NOT NULL DEFAULT 'fireflies',
  raw_transcript TEXT,
  fireflies_meeting_id TEXT,
  created_by UUID REFERENCES auth.users(id),
  import_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- 6. Meeting topics
CREATE TABLE public.meeting_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meeting_topics ENABLE ROW LEVEL SECURITY;

-- 7. Meeting participants
CREATE TABLE public.meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, name)
);
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

-- 8. Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  assignee_name TEXT NOT NULL,
  assignee_user_id UUID REFERENCES auth.users(id),
  due_date DATE,
  priority public.task_priority NOT NULL DEFAULT 'MEDIUM',
  status public.task_status NOT NULL DEFAULT 'OPEN',
  timestamp_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 9. Notes (polymorphic)
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('meeting', 'task')),
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- 10. Imports
CREATE TABLE public.imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type public.import_source NOT NULL,
  file_name TEXT,
  status public.import_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  meetings_created INT NOT NULL DEFAULT 0,
  tasks_created INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;

-- Add FK from meetings to imports
ALTER TABLE public.meetings ADD CONSTRAINT meetings_import_id_fkey FOREIGN KEY (import_id) REFERENCES public.imports(id);

-- 11. Tags
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- 12. Meeting tags (join table)
CREATE TABLE public.meeting_tags (
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (meeting_id, tag_id)
);
ALTER TABLE public.meeting_tags ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS (security definer)
-- ============================================

-- has_role: Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- is_admin: Shorthand for current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- is_meeting_participant: Check if current user is participant of a meeting
CREATE OR REPLACE FUNCTION public.is_meeting_participant(_meeting_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.meeting_participants
    WHERE meeting_id = _meeting_id AND user_id = auth.uid()
  )
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  -- Default role: user
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_imports_updated_at BEFORE UPDATE ON public.imports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "System inserts profiles" ON public.profiles FOR INSERT WITH CHECK (true);

-- USER ROLES
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admins manage roles" ON public.user_roles FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins update roles" ON public.user_roles FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins delete roles" ON public.user_roles FOR DELETE USING (public.is_admin());

-- MEETINGS
CREATE POLICY "Admins see all meetings" ON public.meetings FOR SELECT USING (public.is_admin());
CREATE POLICY "Participants see their meetings" ON public.meetings FOR SELECT USING (public.is_meeting_participant(id));
CREATE POLICY "Authenticated insert meetings" ON public.meetings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins update meetings" ON public.meetings FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins delete meetings" ON public.meetings FOR DELETE USING (public.is_admin());

-- MEETING TOPICS
CREATE POLICY "Admins see all topics" ON public.meeting_topics FOR SELECT USING (public.is_admin());
CREATE POLICY "Participants see topics" ON public.meeting_topics FOR SELECT USING (public.is_meeting_participant(meeting_id));
CREATE POLICY "Auth insert topics" ON public.meeting_topics FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins update topics" ON public.meeting_topics FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins delete topics" ON public.meeting_topics FOR DELETE USING (public.is_admin());

-- MEETING PARTICIPANTS
CREATE POLICY "Admins see all participants" ON public.meeting_participants FOR SELECT USING (public.is_admin());
CREATE POLICY "Participants see co-participants" ON public.meeting_participants FOR SELECT USING (public.is_meeting_participant(meeting_id));
CREATE POLICY "Auth insert participants" ON public.meeting_participants FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete participants" ON public.meeting_participants FOR DELETE USING (public.is_admin());

-- TASKS
CREATE POLICY "Admins see all tasks" ON public.tasks FOR SELECT USING (public.is_admin());
CREATE POLICY "Assignees see their tasks" ON public.tasks FOR SELECT USING (assignee_user_id = auth.uid());
CREATE POLICY "Participants see meeting tasks" ON public.tasks FOR SELECT USING (public.is_meeting_participant(meeting_id));
CREATE POLICY "Auth insert tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins update tasks" ON public.tasks FOR UPDATE USING (public.is_admin());
CREATE POLICY "Assignees update their tasks" ON public.tasks FOR UPDATE USING (assignee_user_id = auth.uid());
CREATE POLICY "Admins delete tasks" ON public.tasks FOR DELETE USING (public.is_admin());

-- NOTES
CREATE POLICY "Admins see all notes" ON public.notes FOR SELECT USING (public.is_admin());
CREATE POLICY "Authors see own notes" ON public.notes FOR SELECT USING (author_id = auth.uid());
CREATE POLICY "Auth insert notes" ON public.notes FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors update own notes" ON public.notes FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Admins update notes" ON public.notes FOR UPDATE USING (public.is_admin());
CREATE POLICY "Authors delete own notes" ON public.notes FOR DELETE USING (author_id = auth.uid());
CREATE POLICY "Admins delete notes" ON public.notes FOR DELETE USING (public.is_admin());

-- IMPORTS (admin only)
CREATE POLICY "Admins manage imports" ON public.imports FOR ALL USING (public.is_admin());

-- TAGS (admin only for write, all authenticated for read)
CREATE POLICY "Authenticated read tags" ON public.tags FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage tags" ON public.tags FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins update tags" ON public.tags FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins delete tags" ON public.tags FOR DELETE USING (public.is_admin());

-- MEETING TAGS
CREATE POLICY "Admins see all meeting_tags" ON public.meeting_tags FOR SELECT USING (public.is_admin());
CREATE POLICY "Participants see meeting tags" ON public.meeting_tags FOR SELECT USING (public.is_meeting_participant(meeting_id));
CREATE POLICY "Admins manage meeting_tags" ON public.meeting_tags FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete meeting_tags" ON public.meeting_tags FOR DELETE USING (public.is_admin());

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_meetings_date ON public.meetings(date DESC);
CREATE INDEX idx_meetings_source ON public.meetings(source);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_user_id);
CREATE INDEX idx_tasks_meeting ON public.tasks(meeting_id);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_meeting_participants_user ON public.meeting_participants(user_id);
CREATE INDEX idx_meeting_participants_meeting ON public.meeting_participants(meeting_id);
CREATE INDEX idx_notes_entity ON public.notes(entity_type, entity_id);
CREATE INDEX idx_imports_status ON public.imports(status);
CREATE INDEX idx_meeting_topics_meeting ON public.meeting_topics(meeting_id);
