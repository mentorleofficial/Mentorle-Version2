-- Rollback for 20261026130000_reschedule_session.sql. Sessions keep the times they were moved to.

DROP FUNCTION IF EXISTS public.reschedule_session(uuid, timestamptz);
ALTER TABLE public.sessions
  DROP COLUMN IF EXISTS previous_scheduled_at,
  DROP COLUMN IF EXISTS rescheduled_at,
  DROP COLUMN IF EXISTS reschedule_email_pending;
