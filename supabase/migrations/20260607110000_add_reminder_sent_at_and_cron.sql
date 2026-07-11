-- 1. Add reminder_sent_at column to sessions table
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Add supabase_api_url column to branding table
ALTER TABLE public.branding
  ADD COLUMN IF NOT EXISTS supabase_api_url TEXT NOT NULL DEFAULT 'http://localhost:54321';

-- 3. Create helpful index for reminder query performance
CREATE INDEX IF NOT EXISTS idx_sessions_reminders
  ON public.sessions (scheduled_at, status, reminder_sent_at)
  WHERE status = 'booked' AND reminder_sent_at IS NULL;

-- 4. Enable pg_cron and pg_net extensions if not enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;

-- 5. Schedule pg_cron job to invoke the reminders edge function every minute
-- It dynamically queries supabase_api_url from the branding table
SELECT cron.schedule(
  'send-session-reminders-job',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(
      (SELECT supabase_api_url FROM public.branding LIMIT 1),
      'http://localhost:54321'
    ) || '/functions/v1/send-session-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
