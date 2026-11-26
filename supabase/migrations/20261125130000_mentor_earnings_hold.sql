-- Mentor earnings are held until the work happens, and taken back when the money goes back.
--
-- Before: a paid session or event credited the mentor ('accrued', withdrawable) the moment the mentee paid, and a
-- cancellation or refund left it there, so a mentor could withdraw for a session that never took place.
--
-- Now:
--   * New session/event earnings start 'pending' (shown as "on hold"; not withdrawable).
--   * Session earnings become 'accrued' when the session is marked completed or no_show (the mentee didn't come), or
--     automatically 7 days after the session's time if it's still 'booked' (so money can't get stuck).
--   * Event earnings become 'accrued' once the event has ended.
--   * A cancelled session or event, or a payment marked refunded, reverses the earning ('reversed'). If it was already
--     withdrawn, a negative 'adjustment' is added, so it comes off the mentor's next payout.
--   * Existing earnings are brought in line once: future sessions/events → pending, cancelled ones → reversed.
-- Withdrawals are unchanged (they take the 'accrued' total, which includes negative adjustments).

ALTER TABLE public.mentor_earnings DROP CONSTRAINT IF EXISTS mentor_earnings_status_check;
ALTER TABLE public.mentor_earnings ADD CONSTRAINT mentor_earnings_status_check CHECK (status IN ('pending', 'accrued', 'withdrawn', 'reversed'));
CREATE INDEX IF NOT EXISTS idx_earnings_reference ON public.mentor_earnings (reference_id);

CREATE OR REPLACE FUNCTION public.earnings_auto_release_days() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 7 $$;

-- The event an event earning belongs to: paid_event earnings point at the registration (event_participants), Plus
-- event earnings at the event itself.
CREATE OR REPLACE FUNCTION public.earning_event(_reference uuid)
RETURNS public.events_programs
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.* FROM public.events_programs e
   WHERE e.id = _reference OR e.id = (SELECT p.event_id FROM public.event_participants p WHERE p.id = _reference)
   LIMIT 1
$$;

-- What a session or event earning should be right now: 'accrued' (it happened), 'reversed' (it won't) or 'pending'.
CREATE OR REPLACE FUNCTION public.earning_state(_source text, _reference uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.sessions;
  ev public.events_programs;
BEGIN
  IF _source IN ('paid_session', 'plus_session') THEN
    SELECT * INTO s FROM public.sessions WHERE id = _reference;
    IF s.id IS NULL THEN
      RETURN 'accrued'; -- legacy or deleted session: nothing to wait for (new earnings always have their session)
    ELSIF s.status IN ('completed', 'no_show') THEN
      RETURN 'accrued';
    ELSIF s.status = 'cancelled' THEN
      RETURN 'reversed';
    ELSIF s.scheduled_at + make_interval(mins => coalesce(s.duration_minutes, 60)) + make_interval(days => public.earnings_auto_release_days()) < now() THEN
      RETURN 'accrued';
    END IF;
    RETURN 'pending';
  ELSIF _source IN ('paid_event', 'plus_event') THEN
    ev := public.earning_event(_reference);
    IF ev.id IS NULL THEN
      RETURN 'accrued'; -- legacy or deleted event
    ELSIF ev.status = 'cancelled' THEN
      RETURN 'reversed';
    ELSIF coalesce(ev.end_date, ev.start_date) < now() THEN
      RETURN 'accrued';
    END IF;
    RETURN 'pending';
  END IF;
  RETURN 'accrued'; -- adjustments and anything else are as written
END;
$$;

-- New session/event earnings are held (or reversed) according to the session/event, whatever the inserting code set.
CREATE OR REPLACE FUNCTION public.hold_new_earning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source IN ('paid_session', 'plus_session', 'paid_event', 'plus_event') AND NEW.status = 'accrued' THEN
    NEW.status := public.earning_state(NEW.source, NEW.reference_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_hold_new_earning ON public.mentor_earnings;
CREATE TRIGGER trg_hold_new_earning BEFORE INSERT ON public.mentor_earnings FOR EACH ROW EXECUTE FUNCTION public.hold_new_earning();

-- Take back the earnings for these references: pending/accrued → reversed; withdrawn → a negative adjustment (once).
CREATE OR REPLACE FUNCTION public.reverse_earnings(_references uuid[], _sources text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mentor_earnings
     SET status = 'reversed'
   WHERE reference_id = ANY (_references) AND source = ANY (_sources) AND status IN ('pending', 'accrued');

  INSERT INTO public.mentor_earnings (mentor_id, source, reference_id, gross_amount, fee_amount, net_amount, status)
  SELECT e.mentor_id, 'adjustment', e.id, -e.gross_amount, -e.fee_amount, -e.net_amount, 'accrued'
    FROM public.mentor_earnings e
   WHERE e.reference_id = ANY (_references) AND e.source = ANY (_sources) AND e.status = 'withdrawn'
     AND NOT EXISTS (SELECT 1 FROM public.mentor_earnings a WHERE a.source = 'adjustment' AND a.reference_id = e.id);
END;
$$;

-- Sessions: completed / no_show releases, cancelled reverses.
CREATE OR REPLACE FUNCTION public.sync_session_earnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('completed', 'no_show') THEN
    UPDATE public.mentor_earnings SET status = 'accrued'
     WHERE reference_id = NEW.id AND source IN ('paid_session', 'plus_session') AND status = 'pending';
  ELSIF NEW.status = 'cancelled' THEN
    PERFORM public.reverse_earnings(ARRAY[NEW.id], ARRAY['paid_session', 'plus_session']);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_session_earnings ON public.sessions;
CREATE TRIGGER trg_sync_session_earnings AFTER UPDATE OF status ON public.sessions
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.sync_session_earnings();

-- Events: a cancelled event reverses its earnings (both kinds of reference).
CREATE OR REPLACE FUNCTION public.sync_event_earnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN
    PERFORM public.reverse_earnings(
      ARRAY[NEW.id] || coalesce((SELECT array_agg(p.id) FROM public.event_participants p WHERE p.event_id = NEW.id), ARRAY[]::uuid[]),
      ARRAY['paid_event', 'plus_event']);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_event_earnings ON public.events_programs;
CREATE TRIGGER trg_sync_event_earnings AFTER UPDATE OF status ON public.events_programs
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.sync_event_earnings();

-- Payments: marking a session or event payment refunded reverses what it earned the mentor.
CREATE OR REPLACE FUNCTION public.sync_refund_earnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reg uuid;
BEGIN
  IF NEW.status <> 'refunded' THEN
    RETURN NEW;
  END IF;
  IF NEW.kind = 'session' AND NEW.session_id IS NOT NULL THEN
    PERFORM public.reverse_earnings(ARRAY[NEW.session_id], ARRAY['paid_session']);
  ELSIF NEW.kind = 'event' THEN
    reg := nullif(NEW.payload ->> 'registration_id', '')::uuid;
    IF reg IS NOT NULL THEN
      PERFORM public.reverse_earnings(ARRAY[reg], ARRAY['paid_event']);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_refund_earnings ON public.payments;
CREATE TRIGGER trg_sync_refund_earnings AFTER UPDATE OF status ON public.payments
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.sync_refund_earnings();

-- Hourly: release earnings whose event has ended or whose session passed the automatic release window.
CREATE OR REPLACE FUNCTION public.release_due_earnings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released integer;
BEGIN
  WITH due AS (
    SELECT e.id FROM public.mentor_earnings e
     WHERE e.status = 'pending' AND public.earning_state(e.source, e.reference_id) = 'accrued'
  )
  UPDATE public.mentor_earnings m SET status = 'accrued' FROM due WHERE m.id = due.id;
  GET DIAGNOSTICS released = ROW_COUNT;
  RETURN released;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.earning_event(uuid), public.earning_state(text, uuid), public.reverse_earnings(uuid[], text[]), public.release_due_earnings()
  FROM public, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'release-due-earnings') THEN
    PERFORM cron.unschedule('release-due-earnings');
  END IF;
END $$;
SELECT cron.schedule('release-due-earnings', '40 * * * *', $cron$ SELECT public.release_due_earnings() $cron$);

-- Bring existing earnings in line (once).
UPDATE public.mentor_earnings e
   SET status = 'pending'
 WHERE e.status = 'accrued' AND e.source IN ('paid_session', 'plus_session', 'paid_event', 'plus_event')
   AND public.earning_state(e.source, e.reference_id) = 'pending';

SELECT public.reverse_earnings(
  coalesce((SELECT array_agg(DISTINCT e.reference_id) FROM public.mentor_earnings e
             WHERE e.source IN ('paid_session', 'plus_session', 'paid_event', 'plus_event') AND e.status IN ('pending', 'accrued', 'withdrawn')
               AND public.earning_state(e.source, e.reference_id) = 'reversed'), ARRAY[]::uuid[]),
  ARRAY['paid_session', 'plus_session', 'paid_event', 'plus_event']);
