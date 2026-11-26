-- Rollback for 20261125140000_session_reminders_vault.sql: pause session reminder emails again.
SELECT cron.unschedule('send-session-reminders-job') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-session-reminders-job');
DROP FUNCTION IF EXISTS public.request_session_reminder_emails();
