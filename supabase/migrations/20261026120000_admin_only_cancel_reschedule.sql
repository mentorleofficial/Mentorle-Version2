-- Only the session's mentor or an admin cancels or reschedules a session; mentees can't.
--
-- Mentees can no longer cancel or reschedule their bookings. Mentors keep cancelling (and may move) their own
-- sessions, alongside marking them completed / no-show and editing notes.
--
--   guard_session_changes   blocks cancelling a session, or changing its time or length, unless the caller is
--                           that session's mentor or an admin. Server-side jobs and edge functions (no signed-in
--                           user) are unaffected.
--   cancel_session()        the session's mentor or an admin.
--   book_session()          new bookings only; _reschedule_from is kept in the signature so older callers still
--                           resolve, but any value is refused.
--   mentor settings         cancellation_notice_hours, allow_reschedule and reschedule_notice_hours are dropped
--                           (default_meeting_url stays), with get_mentor_booking_info / mentor_booking_rules
--                           recreated without them.
--
-- Rollback: supabase/rollbacks/20261026120000_admin_only_cancel_reschedule.sql

-- --- Guard: cancelling and moving sessions --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_session_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR uid = OLD.mentor_id OR public.has_role(uid, 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'Only your mentor or Mentorle admins can cancel sessions' USING ERRCODE = '42501';
  END IF;
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN
    RAISE EXCEPTION 'Only your mentor or Mentorle admins can reschedule sessions' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_session_changes_trg ON public.sessions;
CREATE TRIGGER guard_session_changes_trg
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_session_changes();

-- --- Cancelling: the mentor or an admin ----------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_session(_session_id uuid, _reason text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.sessions WHERE id = _session_id FOR UPDATE;
  IF uid IS NULL OR s.id IS NULL OR NOT (s.mentee_id = uid OR s.mentor_id = uid OR public.has_role(uid, 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  IF s.mentor_id <> uid AND NOT public.has_role(uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only your mentor or Mentorle admins can cancel sessions' USING ERRCODE = '42501';
  END IF;
  IF s.status <> 'booked' THEN
    RAISE EXCEPTION 'Only booked sessions can be cancelled' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.sessions
    SET status = 'cancelled', cancelled_by = uid, cancelled_at = now(), cancellation_reason = left(btrim(coalesce(_reason, '')), 500)
    WHERE id = s.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_session(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_session(uuid, text) TO authenticated;

-- --- Booking: new sessions only -------------------------------------------------------------------------------

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
  link text;
  program uuid := NULL;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Log in to book a session' USING ERRCODE = '42501';
  END IF;
  IF _reschedule_from IS NOT NULL THEN
    RAISE EXCEPTION 'Only your mentor or Mentorle admins can reschedule sessions' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(uid, 'mentee'::public.app_role) THEN
    RAISE EXCEPTION 'Only mentee accounts can book sessions' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mentee_profiles WHERE user_id = uid AND onboarded_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Finish your profile before booking' USING ERRCODE = 'P0001';
  END IF;

  SELECT off.id, off.mentor_id, off.title, off.price, off.duration_minutes, mp.default_meeting_url
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
  IF coalesce(o.price, 0) > 0 THEN
    -- Paid sessions are created by the payment webhook after checkout (cashfree-create-order), never here.
    RAISE EXCEPTION 'This is a paid session: book it through checkout' USING ERRCODE = 'P0001';
  END IF;

  -- One booking at a time per mentor, so two people can't take the same slot.
  PERFORM pg_advisory_xact_lock(hashtextextended(o.mentor_id::text, 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.mentor_open_slots(o.id, (_scheduled_at AT TIME ZONE 'Asia/Kolkata')::date, 1, NULL) s
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

  INSERT INTO public.sessions (mentor_id, mentee_id, scheduled_at, duration_minutes, status, title, topic, mentee_notes,
                               meeting_url, offering_id, program_id)
  VALUES (o.mentor_id, uid, _scheduled_at, o.duration_minutes, 'booked', coalesce(nullif(o.title, ''), 'Mentorship session'), '',
          left(btrim(coalesce(_notes, '')), 2000), link, o.id, program)
  RETURNING id INTO new_id;

  RETURN QUERY SELECT new_id, link;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.book_session(uuid, timestamptz, text, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.book_session(uuid, timestamptz, text, uuid, uuid) TO authenticated;

-- --- Booking info and rules without the cancel / reschedule settings ------------------------------------------

DROP FUNCTION IF EXISTS public.get_mentor_booking_info(uuid);
CREATE FUNCTION public.get_mentor_booking_info(_mentor_id uuid)
RETURNS TABLE (
  id uuid, full_name text, avatar_url text, is_active boolean, timezone text, buffer_time_minutes integer,
  minimum_notice_hours integer, headline text, "current_role" text, current_organization text, bio text,
  expertise text[], years_experience integer, linkedin_url text
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
         mp.headline, mp."current_role", mp.current_organization, mp.bio, mp.expertise, mp.years_experience, mp.linkedin_url
  FROM public.users u
  JOIN public.mentor_profiles mp ON mp.user_id = u.id
  WHERE u.id = _mentor_id AND mp.is_active = true AND u.is_disabled = false;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_mentor_booking_info(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_mentor_booking_info(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.mentor_booking_rules(uuid);
CREATE FUNCTION public.mentor_booking_rules(_mentor_id uuid)
RETURNS TABLE (minimum_notice_hours integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mp.minimum_notice_hours
  FROM public.mentor_profiles mp JOIN public.users u ON u.id = mp.user_id
  WHERE mp.user_id = _mentor_id AND mp.is_active AND NOT u.is_disabled;
$$;
REVOKE EXECUTE ON FUNCTION public.mentor_booking_rules(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.mentor_booking_rules(uuid) TO anon, authenticated;

-- --- Drop the mentor cancel / reschedule settings -------------------------------------------------------------

ALTER TABLE public.mentor_profiles DROP CONSTRAINT IF EXISTS mentor_profiles_booking_settings_check;
ALTER TABLE public.mentor_profiles
  DROP COLUMN IF EXISTS cancellation_notice_hours,
  DROP COLUMN IF EXISTS allow_reschedule,
  DROP COLUMN IF EXISTS reschedule_notice_hours;
ALTER TABLE public.mentor_profiles
  ADD CONSTRAINT mentor_profiles_booking_settings_check CHECK (
    default_meeting_url IS NULL OR default_meeting_url ~* '^https://[^\s]+$'
  );
