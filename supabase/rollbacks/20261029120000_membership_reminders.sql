-- Rollback for 20261029120000_membership_reminders.sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'queue-membership-notices') THEN
    PERFORM cron.unschedule('queue-membership-notices');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-membership-reminders-job') THEN
    PERFORM cron.unschedule('send-membership-reminders-job');
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.request_membership_reminder_emails();
DROP FUNCTION IF EXISTS public.queue_membership_notices();
DROP TABLE IF EXISTS public.membership_notices;
