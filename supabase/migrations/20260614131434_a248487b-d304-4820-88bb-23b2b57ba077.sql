
DROP FUNCTION IF EXISTS public.get_mentor_booking_info(uuid);

CREATE OR REPLACE FUNCTION public.get_mentor_booking_info(_mentor_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  email text,
  is_active boolean,
  timezone text,
  buffer_time_minutes integer,
  minimum_notice_hours integer,
  headline text,
  "current_role" text,
  current_organization text,
  bio text,
  expertise text[],
  years_experience integer,
  linkedin_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
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
  SELECT
    u.id,
    u.full_name,
    u.avatar_url,
    u.email,
    mp.is_active,
    mp.timezone,
    mp.buffer_time_minutes,
    mp.minimum_notice_hours,
    mp.headline,
    mp."current_role",
    mp.current_organization,
    mp.bio,
    mp.expertise,
    mp.years_experience,
    mp.linkedin_url
  FROM public.users u
  JOIN public.mentor_profiles mp ON mp.user_id = u.id
  WHERE u.id = _mentor_id
    AND mp.is_active = true
    AND u.is_disabled = false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mentor_booking_info(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_mentor_booking_info(uuid) FROM anon, public;
