-- Unique constraint so upsert on (user_id, provider) works correctly
ALTER TABLE user_integrations
  ADD CONSTRAINT user_integrations_user_provider_unique UNIQUE (user_id, provider);

-- calendar_events: enable RLS and add user-scoped policy
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'calendar_events'
      AND policyname = 'Users manage own calendar events'
  ) THEN
    CREATE POLICY "Users manage own calendar events"
      ON calendar_events FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;
