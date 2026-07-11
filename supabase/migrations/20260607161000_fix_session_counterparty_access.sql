-- 1. Create a policy on public.users to allow session counterparties (mentor/mentee) to read each other's basic user profile
DROP POLICY IF EXISTS "Mentees/Mentors read sessions counterparty users" ON public.users;
CREATE POLICY "Mentees/Mentors read sessions counterparty users"
ON public.users FOR SELECT TO authenticated
USING (
  is_disabled = false
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE (s.mentor_id = users.id AND s.mentee_id = auth.uid())
       OR (s.mentee_id = users.id AND s.mentor_id = auth.uid())
  )
);

-- 2. Redefine get_mentee_profile_for_mentor to also allow access if a session exists between them
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
    mp.portfolio_url
  FROM public.users u
  JOIN public.mentee_profiles mp ON mp.user_id = u.id
  WHERE u.id = _mentee_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mentee_profile_for_mentor(uuid) TO authenticated;
