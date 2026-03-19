
-- Project status enum
CREATE TYPE public.project_status AS ENUM ('planning', 'active', 'completed', 'archived');

-- Project member role enum
CREATE TYPE public.project_member_role AS ENUM ('owner', 'member', 'viewer');

-- Projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  status project_status NOT NULL DEFAULT 'planning',
  icon text DEFAULT 'folder',
  color text DEFAULT '#3B82F6',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Project members table
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role project_member_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Project documents table
CREATE TABLE public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_path text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add project_id to tasks and meetings
ALTER TABLE public.tasks ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- Updated_at trigger for projects
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

-- Helper: is user a member of project
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = auth.uid()
  )
$$;

-- Projects RLS
CREATE POLICY "Admins manage projects" ON public.projects FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Members see their projects" ON public.projects FOR SELECT TO authenticated USING (is_project_member(id));

-- Project members RLS
CREATE POLICY "Admins manage project members" ON public.project_members FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Members see project members" ON public.project_members FOR SELECT TO authenticated USING (is_project_member(project_id));

-- Project documents RLS
CREATE POLICY "Admins manage project documents" ON public.project_documents FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Members see project documents" ON public.project_documents FOR SELECT TO authenticated USING (is_project_member(project_id));
CREATE POLICY "Members upload project documents" ON public.project_documents FOR INSERT TO authenticated WITH CHECK (is_project_member(project_id));

-- Storage bucket for project documents
INSERT INTO storage.buckets (id, name, public) VALUES ('project-documents', 'project-documents', false);

-- Storage RLS for project-documents bucket
CREATE POLICY "Admins manage project files" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'project-documents' AND is_admin()) WITH CHECK (bucket_id = 'project-documents' AND is_admin());
CREATE POLICY "Members read project files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'project-documents');
CREATE POLICY "Members upload project files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-documents');
