-- Expire "cancel at period end" memberships once their period has passed. Normal renewals are
-- extended by the subscription webhook, so only cancel_at_period_end rows are ever touched here.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-cancelled-memberships') THEN
    PERFORM cron.unschedule('expire-cancelled-memberships');
  END IF;
END $$;

SELECT cron.schedule(
  'expire-cancelled-memberships',
  '17 * * * *',
  $cron$
    UPDATE public.memberships
    SET status = 'expired', updated_at = now()
    WHERE status = 'active'
      AND cancel_at_period_end = true
      AND current_period_end IS NOT NULL
      AND current_period_end < now()
  $cron$
);
