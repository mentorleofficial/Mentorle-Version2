-- Plan reminder emails: the part of 20261029120000_membership_reminders that production doesn't have.
-- That migration was pushed before the email job was added to it, and an applied migration doesn't run again, so
-- production has the in-app notices (queue-membership-notices) but nothing ever emails them. This adds the job
-- that does: like session reminders, it reads 'project_url' and 'cron_secret' from Supabase Vault (does nothing
-- while they're missing) and calls send-membership-reminders with x-cron-secret. Safe to run where it exists.

CREATE OR REPLACE FUNCTION public.request_membership_reminder_emails()
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
  -- Only call out when there's something to email (saves edge-function invocations).
  IF NOT EXISTS (SELECT 1 FROM public.membership_notices WHERE emailed_at IS NULL AND email_attempts < 5) THEN -- 5 = MAX_ATTEMPTS in the function
    RETURN NULL;
  END IF;
  RETURN net.http_post(
    url := rtrim(base, '/') || '/functions/v1/send-membership-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := '{}'::jsonb
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_membership_reminder_emails() FROM public, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-membership-reminders-job') THEN
    PERFORM cron.unschedule('send-membership-reminders-job');
  END IF;
END $$;
-- Hourly, a few minutes after queue-membership-notices (:25).
SELECT cron.schedule('send-membership-reminders-job', '30 * * * *', $cron$ SELECT public.request_membership_reminder_emails() $cron$);
