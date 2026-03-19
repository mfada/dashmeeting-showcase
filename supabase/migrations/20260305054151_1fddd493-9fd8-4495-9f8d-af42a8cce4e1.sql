
-- Budget phases table
CREATE TABLE public.budget_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage budget phases" ON public.budget_phases FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Members see budget phases" ON public.budget_phases FOR SELECT USING (public.is_project_member(project_id));

-- Budget items table
CREATE TABLE public.budget_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phase_id UUID NOT NULL REFERENCES public.budget_phases(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  planned_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  item_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage budget items" ON public.budget_items FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Members see budget items" ON public.budget_items FOR SELECT USING (public.is_project_member(project_id));
CREATE POLICY "Members insert budget items" ON public.budget_items FOR INSERT WITH CHECK (public.is_project_member(project_id));
CREATE POLICY "Members update budget items" ON public.budget_items FOR UPDATE USING (public.is_project_member(project_id));
CREATE POLICY "Members delete budget items" ON public.budget_items FOR DELETE USING (public.is_project_member(project_id));

-- Members can also manage phases
CREATE POLICY "Members insert budget phases" ON public.budget_phases FOR INSERT WITH CHECK (public.is_project_member(project_id));
CREATE POLICY "Members update budget phases" ON public.budget_phases FOR UPDATE USING (public.is_project_member(project_id));
CREATE POLICY "Members delete budget phases" ON public.budget_phases FOR DELETE USING (public.is_project_member(project_id));
