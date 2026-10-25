-- Rescheduling by the session's mentor or an admin.
--
--   reschedule_session()   moves a booked session to a new time in place (same row, same meeting link). The
--                          overlap trigger still refuses clashes for either person. The reminder is re-armed for
--                          the new time, and both people get an in-app notification.
--   sessions columns       previous_scheduled_at and rescheduled_at record the last move;
--                          reschedule_email_pending tells send-booking-email ({ sessionId, kind: "rescheduled" })
--                          that a "your session has moved" email is due, so it goes out once per move.
--
-- Mentees can't reschedule (20261026120000). Rollback: supabase/rollbacks/20261026130000_reschedule_session.sql

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS previous_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_email_pending boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.reschedule_session(_session_id uuid, _scheduled_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.sessions%ROWTYPE;
  is_admin boolean;
  mentor_name text;
  mentee_name text;
  title text;
  old_label text;
  new_label text;
  mover text;
BEGIN
  SELECT * INTO s FROM public.sessions WHERE id = _session_id FOR UPDATE;
  IF uid IS NULL OR s.id IS NULL THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  is_admin := public.has_role(uid, 'admin'::public.app_role);
  IF s.mentor_id <> uid AND NOT is_admin THEN
    RAISE EXCEPTION 'Only your mentor or Mentorle admins can reschedule sessions' USING ERRCODE = '42501';
  END IF;
  IF s.status <> 'booked' THEN
    RAISE EXCEPTION 'Only booked sessions can be rescheduled' USING ERRCODE = 'P0001';
  END IF;
  IF _scheduled_at IS NULL OR _scheduled_at <= now() THEN
    RAISE EXCEPTION 'Pick a time in the future' USING ERRCODE = 'P0001';
  END IF;
  IF _scheduled_at > now() + interval '365 days' THEN
    RAISE EXCEPTION 'Pick a time within the next year' USING ERRCODE = 'P0001';
  END IF;
  IF _scheduled_at = s.scheduled_at THEN
    RAISE EXCEPTION 'That''s the current time. Pick a different one.' USING ERRCODE = 'P0001';
  END IF;

  -- prevent_session_overlap() refuses a clash with either person's other booked sessions.
  UPDATE public.sessions
    SET scheduled_at = _scheduled_at,
        previous_scheduled_at = s.scheduled_at,
        rescheduled_at = now(),
        reschedule_email_pending = true,
        reminder_sent_at = NULL
    WHERE id = s.id;

  SELECT full_name INTO mentor_name FROM public.users WHERE id = s.mentor_id;
  SELECT full_name INTO mentee_name FROM public.users WHERE id = s.mentee_id;
  title := coalesce(nullif(s.title, ''), 'Session');
  old_label := to_char(s.scheduled_at AT TIME ZONE 'Asia/Kolkata', 'Mon DD, YYYY at HH12:MI AM');
  new_label := to_char(_scheduled_at AT TIME ZONE 'Asia/Kolkata', 'Mon DD, YYYY at HH12:MI AM');
  mover := CASE WHEN uid = s.mentor_id THEN coalesce(mentor_name, 'Your mentor') || ' moved "' || title || '"'
                ELSE 'The Mentorle team moved "' || title || '" with ' || coalesce(mentor_name, 'your mentor') END;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (s.mentee_id, 'Session Rescheduled', mover || ' to ' || new_label || ' IST (was ' || old_label || ').', 'session_rescheduled');
  IF uid <> s.mentor_id THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (s.mentor_id, 'Session Rescheduled',
            'The Mentorle team moved "' || title || '" with ' || coalesce(mentee_name, 'your mentee') || ' to ' || new_label || ' IST (was ' || old_label || ').',
            'session_rescheduled');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reschedule_session(uuid, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_session(uuid, timestamptz) TO authenticated;
