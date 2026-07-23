-- Physically delete expired slot holds. get_booked_times already ignores holds past their
-- expiry, and success/failure webhooks delete them — but ABANDONED attempts (user closes the
-- Cashfree modal, no webhook) leave rows that were never swept. Run every 15 minutes.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-slot-holds') THEN
    PERFORM cron.unschedule('cleanup-slot-holds');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-slot-holds',
  '*/15 * * * *',
  $cron$ DELETE FROM public.slot_holds WHERE expires_at < now() $cron$
);
