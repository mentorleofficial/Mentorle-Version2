-- Booking, made safe for mentorle.in and the platform.
--
-- Before: mentees inserted `sessions` rows themselves, and the only check was "you are the mentee and the
-- mentor is active". So through the API anyone could book a paid offering for free, at any time (outside the
-- mentor's hours, in the past, any length), with any status or meeting link. Cancelling was a direct update
-- with no rules.
--
-- Now:
--   mentor_open_slots()  the open start times for an offering, worked out on the server (public: visitors can
--                        browse a mentor's availability before signing up)
--   book_session()       the only way for a mentee to book or reschedule: checks the offering (active, this
--                        mentor's, free unless rescheduling), the time (one of mentor_open_slots), onboarding,
--                        and the mentor's reschedule rules; sets the length, title and meeting link itself
--   cancel_session()     mentee cancellations follow the mentor's cutoff; mentors and admins can always cancel
--   mentor settings      cancellation_notice_hours, allow_reschedule, reschedule_notice_hours, and an optional
--                        own meeting link (default: an automatic Jitsi room per session)
--
-- Also: signed-in users could read every active mentor's full profile row, including phone and resume link
-- (the public-read policy applied to `authenticated`, which has table-wide SELECT). Public reads are now for
-- logged-out visitors only (who are limited to safe columns); signed-in users read their own row, and the one
-- cross-user read (allow_mentee_attachments) has its own function.

-- --- Mentor booking settings ------------------------------------------------------------------------------

ALTER TABLE public.mentor_profiles
  ADD COLUMN IF NOT EXISTS cancellation_notice_hours integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_reschedule boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reschedule_notice_hours integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_meeting_url text;

ALTER TABLE public.mentor_profiles DROP CONSTRAINT IF EXISTS mentor_profiles_booking_settings_check;
ALTER TABLE public.mentor_profiles
  ADD CONSTRAINT mentor_profiles_booking_settings_check CHECK (
    cancellation_notice_hours BETWEEN 0 AND 336
    AND reschedule_notice_hours BETWEEN 0 AND 336
    AND (default_meeting_url IS NULL OR default_meeting_url ~* '^https://[^\s]+$')
  );

-- Sent once per session by send-booking-email (it used to accept any addresses from anyone).
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS booking_email_sent_at timestamptz;

-- --- Mentor profile privacy -------------------------------------------------------------------------------

ALTER POLICY "Public read active mentor profiles" ON public.mentor_profiles TO anon;

CREATE OR REPLACE FUNCTION public.mentor_allows_mentee_attachments(_mentor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT allow_mentee_attachments FROM public.mentor_profiles WHERE user_id = _mentor_id), false);
$$;
REVOKE EXECUTE ON FUNCTION public.mentor_allows_mentee_attachments(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mentor_allows_mentee_attachments(uuid) TO authenticated;

-- --- Open slots ---------------------------------------------------------------------------------------------
-- Same rules the platform's booking dialog applied in the browser (src/components/sessions/BookingModal.tsx):
-- times are IST; the day's ranges come from date overrides (an "unavailable" override blocks the day) or the
-- weekly hours; ranges are cut into back-to-back slots the offering's length; a slot must start after the
-- mentor's minimum notice (at least 5 minutes from now) and within 90 days; and a slot plus the mentor's buffer
-- must not overlap a booked session, the mentor's events, or a payment hold (each plus the buffer).

CREATE OR REPLACE FUNCTION public.mentor_open_slots(
  _offering_id uuid,
  _from date DEFAULT NULL,
  _days integer DEFAULT 90,
  _ignore_session_id uuid DEFAULT NULL -- a session being rescheduled doesn't block its own replacement
)
RETURNS TABLE (starts_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tz constant text := 'Asia/Kolkata';
  o record;
  today date := (now() AT TIME ZONE tz)::date;
  first_day date;
  last_day date;
BEGIN
  SELECT off.id, off.mentor_id, off.duration_minutes, mp.minimum_notice_hours, mp.buffer_time_minutes
    INTO o
  FROM public.mentorship_offerings off
  JOIN public.mentor_profiles mp ON mp.user_id = off.mentor_id
  JOIN public.users u ON u.id = off.mentor_id
  WHERE off.id = _offering_id AND off.status = 'active' AND mp.is_active AND NOT u.is_disabled;
  IF o.id IS NULL OR coalesce(o.duration_minutes, 0) <= 0 THEN
    RETURN;
  END IF;

  first_day := greatest(coalesce(_from, today), today);
  last_day := least(first_day + greatest(coalesce(_days, 90), 1) - 1, today + 90);
  IF last_day < first_day THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT d::date AS day FROM generate_series(first_day, last_day, interval '1 day') d
  ),
  ranges AS (
    -- a date with overrides uses only those (any "unavailable" override blocks the whole day)
    SELECT dy.day, ov.start_time, ov.end_time
    FROM days dy
    JOIN public.mentor_availability_overrides ov ON ov.mentor_id = o.mentor_id AND ov.date = dy.day
    WHERE NOT ov.is_unavailable AND ov.start_time IS NOT NULL AND ov.end_time IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.mentor_availability_overrides x
                      WHERE x.mentor_id = o.mentor_id AND x.date = dy.day AND x.is_unavailable)
    UNION ALL
    SELECT dy.day, a.start_time, a.end_time
    FROM days dy
    JOIN public.mentor_availability a ON a.mentor_id = o.mentor_id AND a.day_of_week = extract(dow FROM dy.day)::int
    WHERE NOT EXISTS (SELECT 1 FROM public.mentor_availability_overrides x WHERE x.mentor_id = o.mentor_id AND x.date = dy.day)
  ),
  candidates AS (
    SELECT DISTINCT ((r.day + r.start_time + make_interval(mins => n * o.duration_minutes)) AT TIME ZONE tz) AS slot_start
    FROM ranges r,
      generate_series(0, ((extract(epoch FROM (r.end_time - r.start_time)) / 60)::int - o.duration_minutes) / o.duration_minutes) n
    WHERE r.end_time > r.start_time
      AND (extract(epoch FROM (r.end_time - r.start_time)) / 60)::int >= o.duration_minutes
  ),
  busy AS (
    SELECT s.scheduled_at AS b_start, s.scheduled_at + make_interval(mins => s.duration_minutes) AS b_end
    FROM public.sessions s
    WHERE s.mentor_id = o.mentor_id AND s.status = 'booked' AND s.id IS DISTINCT FROM _ignore_session_id
    UNION ALL
    SELECT ep.start_date, ep.end_date
    FROM public.events_programs ep
    WHERE ep.created_by = o.mentor_id AND ep.status IN ('upcoming', 'ongoing')
      AND (ep.sessions IS NULL OR jsonb_typeof(ep.sessions) <> 'array' OR jsonb_array_length(ep.sessions) = 0)
    UNION ALL
    SELECT ((e->>'date') || ' ' || (e->>'start_time') || ':00 ' || tz)::timestamptz,
           ((e->>'date') || ' ' || (e->>'end_time') || ':00 ' || tz)::timestamptz
    FROM public.events_programs ep, LATERAL jsonb_array_elements(ep.sessions) e
    WHERE ep.created_by = o.mentor_id AND ep.status IN ('upcoming', 'ongoing')
      AND jsonb_typeof(ep.sessions) = 'array' AND jsonb_array_length(ep.sessions) > 0
    UNION ALL
    SELECT h.scheduled_at, h.scheduled_at + make_interval(mins => h.duration_minutes)
    FROM public.slot_holds h
    WHERE h.mentor_id = o.mentor_id AND h.expires_at > now()
  )
  SELECT c.slot_start
  FROM candidates c
  WHERE c.slot_start >= now() + greatest(make_interval(hours => o.minimum_notice_hours), interval '5 minutes')
    AND NOT EXISTS (
      SELECT 1 FROM busy b
      WHERE c.slot_start < b.b_end + make_interval(mins => o.buffer_time_minutes)
        AND b.b_start < c.slot_start + make_interval(mins => o.duration_minutes + o.buffer_time_minutes)
    )
  ORDER BY c.slot_start;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mentor_open_slots(uuid, date, integer, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.mentor_open_slots(uuid, date, integer, uuid) TO anon, authenticated;

-- --- Booking ------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.book_session(
  _offering_id uuid,
  _scheduled_at timestamptz,
  _notes text DEFAULT '',
  _program_id uuid DEFAULT NULL,
  _reschedule_from uuid DEFAULT NULL
)
RETURNS TABLE (session_id uuid, meeting_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  o record;
  original public.sessions%ROWTYPE;
  link text;
  program uuid := NULL;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Log in to book a session' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(uid, 'mentee'::public.app_role) THEN
    RAISE EXCEPTION 'Only mentee accounts can book sessions' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mentee_profiles WHERE user_id = uid AND onboarded_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Finish your profile before booking' USING ERRCODE = 'P0001';
  END IF;

  SELECT off.id, off.mentor_id, off.title, off.price, off.duration_minutes,
         mp.allow_reschedule, mp.reschedule_notice_hours, mp.default_meeting_url
    INTO o
  FROM public.mentorship_offerings off
  JOIN public.mentor_profiles mp ON mp.user_id = off.mentor_id
  JOIN public.users u ON u.id = off.mentor_id
  WHERE off.id = _offering_id AND off.status = 'active' AND mp.is_active AND NOT u.is_disabled;
  IF o.id IS NULL THEN
    RAISE EXCEPTION 'This session isn''t available to book' USING ERRCODE = 'P0001';
  END IF;
  IF o.mentor_id = uid THEN
    RAISE EXCEPTION 'You can''t book your own session' USING ERRCODE = 'P0001';
  END IF;

  IF _reschedule_from IS NOT NULL THEN
    SELECT * INTO original FROM public.sessions WHERE id = _reschedule_from FOR UPDATE;
    IF original.id IS NULL OR original.mentee_id <> uid OR original.status <> 'booked' OR original.scheduled_at <= now() THEN
      RAISE EXCEPTION 'This session can''t be rescheduled' USING ERRCODE = 'P0001';
    END IF;
    IF original.mentor_id <> o.mentor_id OR (original.offering_id IS NOT NULL AND original.offering_id <> o.id) THEN
      RAISE EXCEPTION 'Reschedule to the same session type with the same mentor' USING ERRCODE = 'P0001';
    END IF;
    IF NOT o.allow_reschedule THEN
      RAISE EXCEPTION 'This mentor doesn''t allow rescheduling' USING ERRCODE = 'P0001';
    END IF;
    IF now() > original.scheduled_at - make_interval(hours => o.reschedule_notice_hours) THEN
      RAISE EXCEPTION 'Rescheduling closes % hours before the session', o.reschedule_notice_hours USING ERRCODE = 'P0001';
    END IF;
  ELSIF coalesce(o.price, 0) > 0 THEN
    -- Paid sessions are created by the payment webhook after checkout (cashfree-create-order), never here.
    RAISE EXCEPTION 'This is a paid session: book it through checkout' USING ERRCODE = 'P0001';
  END IF;

  -- One booking at a time per mentor, so two people can't take the same slot.
  PERFORM pg_advisory_xact_lock(hashtextextended(o.mentor_id::text, 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.mentor_open_slots(o.id, (_scheduled_at AT TIME ZONE 'Asia/Kolkata')::date, 1, _reschedule_from) s
    WHERE s.starts_at = _scheduled_at
  ) THEN
    RAISE EXCEPTION 'That time is no longer available. Please pick another.' USING ERRCODE = '23P01';
  END IF;

  -- Program sessions only when both are in the program.
  IF _program_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.program_mentors WHERE program_id = _program_id AND mentor_id = o.mentor_id)
     AND EXISTS (SELECT 1 FROM public.program_mentees WHERE program_id = _program_id AND mentee_id = uid) THEN
    program := _program_id;
  END IF;

  link := coalesce(nullif(btrim(o.default_meeting_url), ''), 'https://meet.jit.si/mentorle-' || gen_random_uuid());

  -- Cancel the original first so the replacement may overlap it.
  IF original.id IS NOT NULL THEN
    UPDATE public.sessions
      SET status = 'cancelled', cancelled_by = uid, cancelled_at = now(), cancellation_reason = 'Rescheduled'
      WHERE id = original.id;
  END IF;

  INSERT INTO public.sessions (mentor_id, mentee_id, scheduled_at, duration_minutes, status, title, topic, mentee_notes,
                               meeting_url, offering_id, program_id, rescheduled_from_id)
  VALUES (o.mentor_id, uid, _scheduled_at, o.duration_minutes, 'booked', coalesce(nullif(o.title, ''), 'Mentorship session'), '',
          left(btrim(coalesce(_notes, '')), 2000), link, o.id, program, original.id)
  RETURNING id INTO new_id;

  RETURN QUERY SELECT new_id, link;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.book_session(uuid, timestamptz, text, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.book_session(uuid, timestamptz, text, uuid, uuid) TO authenticated;

-- --- Cancelling ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_session(_session_id uuid, _reason text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.sessions%ROWTYPE;
  cutoff integer;
BEGIN
  SELECT * INTO s FROM public.sessions WHERE id = _session_id FOR UPDATE;
  IF uid IS NULL OR s.id IS NULL OR NOT (s.mentee_id = uid OR s.mentor_id = uid OR public.has_role(uid, 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  IF s.status <> 'booked' THEN
    RAISE EXCEPTION 'Only booked sessions can be cancelled' USING ERRCODE = 'P0001';
  END IF;
  -- Mentees follow the mentor's cutoff; mentors and admins can always cancel.
  IF s.mentee_id = uid AND s.mentor_id <> uid AND NOT public.has_role(uid, 'admin'::public.app_role) THEN
    IF s.scheduled_at <= now() THEN
      RAISE EXCEPTION 'This session has already started' USING ERRCODE = 'P0001';
    END IF;
    SELECT cancellation_notice_hours INTO cutoff FROM public.mentor_profiles WHERE user_id = s.mentor_id;
    IF now() > s.scheduled_at - make_interval(hours => coalesce(cutoff, 0)) THEN
      RAISE EXCEPTION 'Cancellations close % hours before the session', coalesce(cutoff, 0) USING ERRCODE = 'P0001';
    END IF;
  END IF;
  UPDATE public.sessions
    SET status = 'cancelled', cancelled_by = uid, cancelled_at = now(), cancellation_reason = left(btrim(coalesce(_reason, '')), 500)
    WHERE id = s.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_session(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_session(uuid, text) TO authenticated;

-- --- Mentees write sessions only through the functions above -----------------------------------------------
DROP POLICY IF EXISTS "Mentees book sessions" ON public.sessions;
DROP POLICY IF EXISTS "Mentees cancel own sessions" ON public.sessions;

-- --- Booking info without the mentor's email ---------------------------------------------------------------
-- The browser only needed it to call send-booking-email, which now looks people up itself.
DROP FUNCTION IF EXISTS public.get_mentor_booking_info(uuid);
CREATE FUNCTION public.get_mentor_booking_info(_mentor_id uuid)
RETURNS TABLE (
  id uuid, full_name text, avatar_url text, is_active boolean, timezone text, buffer_time_minutes integer,
  minimum_notice_hours integer, headline text, "current_role" text, current_organization text, bio text,
  expertise text[], years_experience integer, linkedin_url text,
  cancellation_notice_hours integer, allow_reschedule boolean, reschedule_notice_hours integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.can_mentee_book_mentor(auth.uid(), _mentor_id)) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT u.id, u.full_name, u.avatar_url, mp.is_active, mp.timezone, mp.buffer_time_minutes, mp.minimum_notice_hours,
         mp.headline, mp."current_role", mp.current_organization, mp.bio, mp.expertise, mp.years_experience, mp.linkedin_url,
         mp.cancellation_notice_hours, mp.allow_reschedule, mp.reschedule_notice_hours
  FROM public.users u
  JOIN public.mentor_profiles mp ON mp.user_id = u.id
  WHERE u.id = _mentor_id AND mp.is_active = true AND u.is_disabled = false;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_mentor_booking_info(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_mentor_booking_info(uuid) TO authenticated;

-- Public booking rules for an offering's mentor (shown on mentorle.in before signing in).
CREATE OR REPLACE FUNCTION public.mentor_booking_rules(_mentor_id uuid)
RETURNS TABLE (minimum_notice_hours integer, cancellation_notice_hours integer, allow_reschedule boolean, reschedule_notice_hours integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mp.minimum_notice_hours, mp.cancellation_notice_hours, mp.allow_reschedule, mp.reschedule_notice_hours
  FROM public.mentor_profiles mp JOIN public.users u ON u.id = mp.user_id
  WHERE mp.user_id = _mentor_id AND mp.is_active AND NOT u.is_disabled;
$$;
REVOKE EXECUTE ON FUNCTION public.mentor_booking_rules(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.mentor_booking_rules(uuid) TO anon, authenticated;
