-- 1. Create get_mentor_booking_info RPC
CREATE OR REPLACE FUNCTION public.get_mentor_booking_info(_mentor_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  email text,
  is_active boolean,
  timezone text,
  buffer_time_minutes integer,
  minimum_notice_hours integer
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Check if caller is authenticated
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Check if caller is allowed to book this mentor OR is admin
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
    mp.minimum_notice_hours
  FROM public.users u
  JOIN public.mentor_profiles mp ON mp.user_id = u.id
  WHERE u.id = _mentor_id
    AND mp.is_active = true
    AND u.is_disabled = false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mentor_booking_info(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_mentor_booking_info(uuid) FROM anon, public;

-- 2. Create get_booked_times RPC
CREATE OR REPLACE FUNCTION public.get_booked_times(_mentor_id uuid)
RETURNS TABLE (
  id uuid,
  scheduled_at timestamptz,
  duration_minutes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Check if caller is authenticated
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Check if caller is allowed to book this mentor OR is admin
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.can_mentee_book_mentor(auth.uid(), _mentor_id)) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.scheduled_at,
    s.duration_minutes
  FROM public.sessions s
  WHERE s.mentor_id = _mentor_id
    AND s.status = 'booked';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booked_times(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_booked_times(uuid) FROM anon, public;
