-- Plan pass reminders: tell members before and after their pass ends (one-time passes don't renew themselves).
--   ending_7d  7 days before the end   bell + email
--   ending_1d  1 day before the end    bell + email
--   ended      once it has ended       bell + email (only within 3 days of the end, so old passes stay quiet)
-- queue_membership_notices() runs hourly from pg_cron and writes the bell notifications itself. Emails are sent by the
-- send-membership-reminders edge function, which picks up the notices that haven't been emailed yet. pg_cron calls it
-- with two Supabase Vault secrets, so nothing secret is in this file:
--   project_url  e.g. https://<project-ref>.supabase.co
--   cron_secret  the same value as the functions' CRON_SECRET
-- Until both exist the email job does nothing (the bell notifications still go out).
-- Each notice is keyed by (membership, kind, period end): it goes out once per pass period, and renewing early moves
-- the end date, so the old period's remaining reminders never fire and the new period gets its own.

CREATE TABLE IF NOT EXISTS public.membership_notices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id  uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('ending_7d', 'ending_1d', 'ended')),
  period_end     timestamptz NOT NULL,
  plan_name      text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  emailed_at     timestamptz,
  email_attempts integer NOT NULL DEFAULT 0,
  UNIQUE (membership_id, kind, period_end)
);
CREATE INDEX IF NOT EXISTS idx_membership_notices_unsent ON public.membership_notices (created_at) WHERE emailed_at IS NULL;

-- Internal bookkeeping: only the service role (edge function) and SECURITY DEFINER code touch it.
ALTER TABLE public.membership_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_notices FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.queue_membership_notices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  notice_kind text;
  ends_label text;
  free_name text;
  queued integer := 0;
  nid uuid;
BEGIN
  SELECT name INTO free_name FROM public.subscription_plans WHERE is_active AND billing = 'free' ORDER BY sort_order LIMIT 1;

  FOR r IN
    SELECT m.id, m.user_id, m.current_period_end AS ends, coalesce(p.name, 'Mentorle plan') AS plan_name
      FROM public.memberships m
      LEFT JOIN public.subscription_plans p ON p.id = m.plan_id
     WHERE m.cancel_at_period_end            -- passes that end (one-time passes, cancelled legacy subscriptions)
       AND m.status IN ('active', 'expired')
       AND m.current_period_end IS NOT NULL
       AND m.current_period_end > now() - interval '3 days'
       AND m.current_period_end <= now() + interval '7 days'
  LOOP
    notice_kind := CASE
      WHEN r.ends <= now() THEN 'ended'
      WHEN r.ends <= now() + interval '1 day' THEN 'ending_1d'
      ELSE 'ending_7d'
    END;
    -- Moved on already (bought another pass after this one ended): nothing to remind them about.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.memberships o
       WHERE o.user_id = r.user_id AND o.id <> r.id AND o.status = 'active'
         AND (o.current_period_end IS NULL OR o.current_period_end > r.ends));

    INSERT INTO public.membership_notices (membership_id, user_id, kind, period_end, plan_name)
    VALUES (r.id, r.user_id, notice_kind, r.ends, r.plan_name)
    ON CONFLICT (membership_id, kind, period_end) DO NOTHING
    RETURNING id INTO nid;
    CONTINUE WHEN nid IS NULL;

    ends_label := to_char(r.ends AT TIME ZONE 'Asia/Kolkata', 'Mon DD, YYYY');
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      r.user_id,
      CASE notice_kind
        WHEN 'ended' THEN 'Your ' || r.plan_name || ' has ended'
        WHEN 'ending_1d' THEN 'Your ' || r.plan_name || ' ends tomorrow'
        ELSE 'Your ' || r.plan_name || ' ends in 7 days'
      END,
      CASE notice_kind
        WHEN 'ended' THEN 'It ended on ' || ends_label || '. You''re on ' || coalesce(free_name, 'the free plan')
                          || ' now. Renew from the pricing page to get your member benefits back.'
        ELSE 'It ends on ' || ends_label || '. Renew before then to keep your member benefits; the new year is added on top.'
      END,
      CASE notice_kind WHEN 'ended' THEN 'membership_ended' ELSE 'membership_ending' END
    );
    queued := queued + 1;
  END LOOP;
  RETURN queued;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.queue_membership_notices() FROM public, anon, authenticated;

-- Asks send-membership-reminders to email the pending notices. Returns the pg_net request id, or null when the
-- Vault secrets aren't set up yet.
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
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'queue-membership-notices') THEN
    PERFORM cron.unschedule('queue-membership-notices');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-membership-reminders-job') THEN
    PERFORM cron.unschedule('send-membership-reminders-job');
  END IF;
END $$;

-- Hourly: notices after expire-cancelled-memberships (:17), emails a few minutes later.
SELECT cron.schedule('queue-membership-notices', '25 * * * *', $cron$ SELECT public.queue_membership_notices() $cron$);
SELECT cron.schedule('send-membership-reminders-job', '30 * * * *', $cron$ SELECT public.request_membership_reminder_emails() $cron$);
