-- Undo 20261025120000. WARNING: reopens free booking of paid sessions and mentor phone/resume reads.

CREATE POLICY "Mentees book sessions" ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (((mentee_id = (SELECT auth.uid())) AND can_mentee_book_mentor((SELECT auth.uid()), mentor_id)));

CREATE POLICY "Mentees cancel own sessions" ON public.sessions
  FOR UPDATE TO authenticated
  USING ((mentee_id = (SELECT auth.uid())))
  WITH CHECK (((mentee_id = (SELECT auth.uid())) AND (status = 'cancelled'::session_status)));

ALTER POLICY "Public read active mentor profiles" ON public.mentor_profiles TO anon, authenticated;

DROP FUNCTION IF EXISTS public.mentor_booking_rules(uuid);
DROP FUNCTION IF EXISTS public.cancel_session(uuid, text);
DROP FUNCTION IF EXISTS public.book_session(uuid, timestamptz, text, uuid, uuid);
DROP FUNCTION IF EXISTS public.mentor_open_slots(uuid, date, integer, uuid);
DROP FUNCTION IF EXISTS public.mentor_allows_mentee_attachments(uuid);

DROP FUNCTION IF EXISTS public.get_mentor_booking_info(uuid);
CREATE FUNCTION public.get_mentor_booking_info(_mentor_id uuid)
RETURNS TABLE(id uuid, full_name text, avatar_url text, email text, is_active boolean, timezone text, buffer_time_minutes integer,
              minimum_notice_hours integer, headline text, "current_role" text, current_organization text, bio text,
              expertise text[], years_experience integer, linkedin_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.can_mentee_book_mentor(auth.uid(), _mentor_id)) THEN RETURN; END IF;
  RETURN QUERY
  SELECT u.id, u.full_name, u.avatar_url, u.email, mp.is_active, mp.timezone, mp.buffer_time_minutes, mp.minimum_notice_hours,
         mp.headline, mp."current_role", mp.current_organization, mp.bio, mp.expertise, mp.years_experience, mp.linkedin_url
  FROM public.users u JOIN public.mentor_profiles mp ON mp.user_id = u.id
  WHERE u.id = _mentor_id AND mp.is_active = true AND u.is_disabled = false;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.get_mentor_booking_info(uuid) TO authenticated;

ALTER TABLE public.sessions DROP COLUMN IF EXISTS booking_email_sent_at;
ALTER TABLE public.mentor_profiles DROP CONSTRAINT IF EXISTS mentor_profiles_booking_settings_check;
ALTER TABLE public.mentor_profiles
  DROP COLUMN IF EXISTS cancellation_notice_hours,
  DROP COLUMN IF EXISTS allow_reschedule,
  DROP COLUMN IF EXISTS reschedule_notice_hours,
  DROP COLUMN IF EXISTS default_meeting_url;
