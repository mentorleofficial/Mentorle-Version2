-- Run AFTER: (1) BREVO_API_KEY and CRON_SECRET secrets are set, (2) send-session-reminders
-- is deployed. Replace <CRON_SECRET> with the same value stored in the function secrets.
-- Reverses the pause from migration 20260717130000.

UPDATE public.branding
SET supabase_api_url = 'https://xykindgwltvgcrcuwmik.supabase.co';

SELECT cron.schedule(
  'send-session-reminders-job',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(
      (SELECT supabase_api_url FROM public.branding LIMIT 1),
      'http://localhost:54321'
    ) || '/functions/v1/send-session-reminders',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
