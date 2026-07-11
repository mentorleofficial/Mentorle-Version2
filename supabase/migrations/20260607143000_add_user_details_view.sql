-- 1. Add extra columns to mentee_profiles
ALTER TABLE public.mentee_profiles
  ADD COLUMN IF NOT EXISTS academic_details TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS github_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT NOT NULL DEFAULT '';

-- 2. Create the get_mentee_profile_for_mentor RPC
CREATE OR REPLACE FUNCTION public.get_mentee_profile_for_mentor(_mentee_id uuid)
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
  portfolio_url text
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

  -- Check if caller is a mentor who shares a program with the mentee, OR is admin, OR has assignment
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
    mp.portfolio_url
  FROM public.users u
  JOIN public.mentee_profiles mp ON mp.user_id = u.id
  WHERE u.id = _mentee_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mentee_profile_for_mentor(uuid) TO authenticated;
