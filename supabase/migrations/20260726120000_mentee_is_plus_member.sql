-- Allow mentors (with a relationship) and admins to check if a mentee has active Plus.
CREATE OR REPLACE FUNCTION public.mentee_is_plus_member(p_mentee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_mentee_id IS NULL THEN
    RETURN false;
  END IF;

  -- Caller may check themselves
  IF auth.uid() = p_mentee_id THEN
    RETURN EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = p_mentee_id AND m.status = 'active'
    );
  END IF;

  -- Admin, or mentor sharing program / assignment / session with the mentee
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.program_mentees pme
      JOIN public.program_mentors pmt ON pmt.program_id = pme.program_id
      WHERE pme.mentee_id = p_mentee_id AND pmt.mentor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.mentor_mentee_assignments mma
      WHERE mma.mentee_id = p_mentee_id AND mma.mentor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.mentee_id = p_mentee_id AND s.mentor_id = auth.uid()
    )
  ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = p_mentee_id AND m.status = 'active'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mentee_is_plus_member(uuid) TO authenticated;
