
-- Add BLOCKED to task_status enum
ALTER TYPE task_status ADD VALUE 'BLOCKED';

-- Create task_status_log table
CREATE TABLE public.task_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  old_status task_status,
  new_status task_status NOT NULL,
  changed_by uuid NOT NULL,
  changed_by_name text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_status_log ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins manage status logs"
ON public.task_status_log
FOR ALL
USING (is_admin());

-- Assignees can read logs for their tasks
CREATE POLICY "Assignees read task status logs"
ON public.task_status_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_status_log.task_id
    AND tasks.assignee_user_id = auth.uid()
  )
);

-- Meeting participants can read logs for their tasks
CREATE POLICY "Participants read task status logs"
ON public.task_status_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_status_log.task_id
    AND is_meeting_participant(tasks.meeting_id)
  )
);

-- Authenticated users can insert logs (when changing status)
CREATE POLICY "Auth insert status logs"
ON public.task_status_log
FOR INSERT
WITH CHECK (auth.uid() = changed_by);

-- Index for fast lookups
CREATE INDEX idx_task_status_log_task_id ON public.task_status_log(task_id);
CREATE INDEX idx_task_status_log_created_at ON public.task_status_log(created_at DESC);
