-- Rollback for 20261125150000_membership_reminder_emails.sql: stop emailing plan reminders (in-app notices continue).
SELECT cron.unschedule('send-membership-reminders-job') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-membership-reminders-job');
DROP FUNCTION IF EXISTS public.request_membership_reminder_emails();
