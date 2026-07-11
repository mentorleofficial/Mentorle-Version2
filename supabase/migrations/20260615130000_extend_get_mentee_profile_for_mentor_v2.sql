-- Extend get_mentee_profile_for_mentor v2: add email, phone, current_status,
-- education_level, education_details, work_experience, languages,
-- preferred_industries, preferred_mentor_qualities, instagram_url
-- Must DROP first because PostgreSQL does not allow changing the return type with CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.get_mentee_profile_for_mentor(uuid);

CREATE FUNCTION public.get_mentee_profile_for_mentor(_mentee_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  headline text,
  goals text,
  interests text[],
  organization_unit text,
  preferred_mentor_areas text[],
  academic_details text,
  github_url text,
  portfolio_url text,
  -- extended set 1 (added in previous migration)
  preferred_time_windows text[],
  preferred_session_types text[],
  skills text[],
  resume_url text,
  linkedin_url text,
  location text,
  timezone text,
  -- extended set 2 (added in this migration)
  email text,
  phone text,
  current_status text,
  education_level text,
  education_details jsonb,
  work_experience jsonb,
  languages text[],
  preferred_industries text[],
  preferred_mentor_qualities text[],
  instagram_url text
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

  -- Check if caller is admin, OR is a mentor sharing a program/assignment/session with the mentee
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.program_mentees pme
      JOIN public.program_mentors pmt ON pmt.program_id = pme.program_id
      WHERE pme.mentee_id = _mentee_id AND pmt.mentor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.mentor_mentee_assignments mma
      WHERE mma.mentee_id = _mentee_id AND mma.mentor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.mentee_id = _mentee_id AND s.mentor_id = auth.uid()
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.full_name,
    u.avatar_url,
    mp.bio,
    mp.headline,
    mp.goals,
    mp.interests,
    mp.organization_unit,
    mp.preferred_mentor_areas,
    mp.academic_details,
    mp.github_url,
    mp.portfolio_url,
    COALESCE(mp.preferred_time_windows, ARRAY[]::text[]),
    COALESCE(mp.preferred_session_types, ARRAY[]::text[]),
    COALESCE(mp.skills, ARRAY[]::text[]),
    mp.resume_url,
    mp.linkedin_url,
    mp.location,
    mp.timezone,
    -- set 2
    u.email,
    mp.phone,
    mp.current_status,
    mp.education_level,
    mp.education_details,
    mp.work_experience,
    COALESCE(mp.languages, ARRAY[]::text[]),
    COALESCE(mp.preferred_industries, ARRAY[]::text[]),
    COALESCE(mp.preferred_mentor_qualities, ARRAY[]::text[]),
    mp.instagram_url
  FROM public.users u
  JOIN public.mentee_profiles mp ON mp.user_id = u.id
  WHERE u.id = _mentee_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mentee_profile_for_mentor(uuid) TO authenticated;
