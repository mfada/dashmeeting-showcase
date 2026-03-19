
CREATE TABLE public.calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  location text,
  source text NOT NULL DEFAULT 'office365',
  external_id text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_id)
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own calendar events"
  ON public.calendar_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own calendar events"
  ON public.calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own calendar events"
  ON public.calendar_events FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own calendar events"
  ON public.calendar_events FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage all calendar events"
  ON public.calendar_events FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
