-- Session reminder emails ("starts in 30 minutes") back on.
-- They were paused in 20260717130000 because the old job built a malformed URL and sent no auth. Now, like the plan
-- reminders, the URL and the shared secret come from Supabase Vault ('project_url', 'cron_secret'); while those
-- aren't set the job does nothing. send-session-reminders checks x-cron-secret and emails sessions starting in
-- 25–35 minutes that haven't had a reminder, so running every 5 minutes reaches each session once.

CREATE OR REPLACE FUNCTION public.request_session_reminder_emails()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  secret text;
BEGIN
  SELECT decrypted_secret INTO base FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';
  IF coalesce(base, '') = '' OR coalesce(secret, '') = '' THEN
    RETURN NULL;
  END IF;
  -- Only call out when a session is actually coming up (saves edge-function invocations).
  IF NOT EXISTS (
    SELECT 1 FROM public.sessions
     WHERE status = 'booked' AND reminder_sent_at IS NULL
       AND scheduled_at BETWEEN now() + interval '25 minutes' AND now() + interval '35 minutes'
  ) THEN
    RETURN NULL;
  END IF;
  RETURN net.http_post(
    url := rtrim(base, '/') || '/functions/v1/send-session-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := '{}'::jsonb
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_session_reminder_emails() FROM public, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-session-reminders-job') THEN
    PERFORM cron.unschedule('send-session-reminders-job');
  END IF;
END $$;
SELECT cron.schedule('send-session-reminders-job', '*/5 * * * *', $cron$ SELECT public.request_session_reminder_emails() $cron$);
