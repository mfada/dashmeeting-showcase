-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule Office 365 sync every 30 minutes
-- Reads service_role_key from Supabase Vault (add it as secret named 'service_role_key')
SELECT cron.schedule(
  'sync-office365-calendar',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pifzwdcqhgurlrtkiyto.supabase.co/functions/v1/sync-office365',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  )
  $$
);
