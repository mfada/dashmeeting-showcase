
-- Task dependencies table
CREATE TABLE public.task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id),
  CHECK (task_id != depends_on_task_id)
);

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins manage dependencies"
ON public.task_dependencies FOR ALL USING (is_admin());

-- Assignees can read dependencies for their tasks
CREATE POLICY "Assignees read dependencies"
ON public.task_dependencies FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_dependencies.task_id AND tasks.assignee_user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_dependencies.depends_on_task_id AND tasks.assignee_user_id = auth.uid())
);

-- Participants can read
CREATE POLICY "Participants read dependencies"
ON public.task_dependencies FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_dependencies.task_id AND is_meeting_participant(tasks.meeting_id))
);

-- Auth users can insert/delete their own task dependencies
CREATE POLICY "Auth insert dependencies"
ON public.task_dependencies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth delete dependencies"
ON public.task_dependencies FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_task_deps_task_id ON public.task_dependencies(task_id);
CREATE INDEX idx_task_deps_depends_on ON public.task_dependencies(depends_on_task_id);
