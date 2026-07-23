-- Slot-hold: reserve a mentor's slot while a paid booking's payment is in flight, so two
-- mentees can't pay for the same time. Holds expire; get_booked_times reports active holds
-- as taken; the webhook releases the hold on payment success/failure.

CREATE TABLE IF NOT EXISTS public.slot_holds (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mentee_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scheduled_at     timestamptz NOT NULL,
  duration_minutes integer NOT NULL,
  payment_id       uuid REFERENCES public.payments(id) ON DELETE CASCADE,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- One active hold per mentor slot — the hard guarantee against a double-book race.
CREATE UNIQUE INDEX IF NOT EXISTS slot_holds_mentor_slot_unique
  ON public.slot_holds (mentor_id, scheduled_at);
CREATE INDEX IF NOT EXISTS slot_holds_expires_idx ON public.slot_holds (expires_at);

ALTER TABLE public.slot_holds ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (edge functions) writes; held times are exposed
-- anonymously through get_booked_times (SECURITY DEFINER). Default-deny for everyone else.

-- Atomically reserve a slot. Returns the hold id, or NULL if the slot is already booked
-- or actively held by someone else.
CREATE OR REPLACE FUNCTION public.reserve_slot(
  _mentor_id    uuid,
  _mentee_id    uuid,
  _scheduled_at timestamptz,
  _duration     integer,
  _payment_id   uuid,
  _ttl_minutes  integer
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _hold_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.sessions
    WHERE mentor_id = _mentor_id AND scheduled_at = _scheduled_at AND status = 'booked'
  ) THEN
    RETURN NULL;
  END IF;

  DELETE FROM public.slot_holds
    WHERE mentor_id = _mentor_id AND scheduled_at = _scheduled_at AND expires_at < now();

  INSERT INTO public.slot_holds (mentor_id, mentee_id, scheduled_at, duration_minutes, payment_id, expires_at)
    VALUES (_mentor_id, _mentee_id, _scheduled_at, _duration, _payment_id, now() + make_interval(mins => _ttl_minutes))
    ON CONFLICT (mentor_id, scheduled_at) DO NOTHING
    RETURNING id INTO _hold_id;

  RETURN _hold_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_slot(uuid, uuid, timestamptz, integer, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_slot(uuid, uuid, timestamptz, integer, uuid, integer) TO service_role;

-- Security fix: consume_plus_session was only revoked from anon/authenticated, but the default
-- EXECUTE grant to PUBLIC remained — an authenticated user could call it directly and forge
-- mentor earnings / usage. Lock it to the service role only.
REVOKE ALL ON FUNCTION public.consume_plus_session(uuid, text, uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_plus_session(uuid, text, uuid, uuid, numeric) TO service_role;

-- Extend get_booked_times to also report active slot holds as taken.
CREATE OR REPLACE FUNCTION public.get_booked_times(_mentor_id uuid)
RETURNS TABLE (id uuid, scheduled_at timestamptz, duration_minutes integer)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.can_mentee_book_mentor(auth.uid(), _mentor_id)) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.id, s.scheduled_at, s.duration_minutes
  FROM public.sessions s
  WHERE s.mentor_id = _mentor_id AND s.status = 'booked'

  UNION ALL
  SELECT ep.id, ep.start_date, EXTRACT(EPOCH FROM (ep.end_date - ep.start_date))::integer / 60
  FROM public.events_programs ep
  WHERE ep.created_by = _mentor_id
    AND ep.status IN ('upcoming', 'ongoing')
    AND (ep.sessions IS NULL OR jsonb_array_length(ep.sessions) = 0)

  UNION ALL
  SELECT ep.id,
    ((s_elem->>'date') || ' ' || (s_elem->>'start_time') || ':00 Asia/Kolkata')::timestamptz,
    (EXTRACT(EPOCH FROM (
      ((s_elem->>'date') || ' ' || (s_elem->>'end_time') || ':00 Asia/Kolkata')::timestamptz -
      ((s_elem->>'date') || ' ' || (s_elem->>'start_time') || ':00 Asia/Kolkata')::timestamptz
    ))::integer / 60)
  FROM public.events_programs ep, LATERAL jsonb_array_elements(ep.sessions) AS s_elem
  WHERE ep.created_by = _mentor_id
    AND ep.status IN ('upcoming', 'ongoing')
    AND ep.sessions IS NOT NULL
    AND jsonb_array_length(ep.sessions) > 0

  UNION ALL
  -- Active slot holds (paid bookings mid-payment)
  SELECT h.id, h.scheduled_at, h.duration_minutes
  FROM public.slot_holds h
  WHERE h.mentor_id = _mentor_id AND h.expires_at > now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booked_times(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_booked_times(uuid) FROM anon, public;
