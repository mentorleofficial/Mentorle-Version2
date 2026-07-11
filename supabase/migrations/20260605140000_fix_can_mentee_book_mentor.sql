-- Fix can_mentee_book_mentor to allow booking when:
-- 1. Mentor is not in any program (free/public mode), OR
-- 2. Mentee is enrolled in the same program as the mentor
--    (even without a direct mentor_mentee_assignment), OR
-- 3. There is an explicit mentor_mentee_assignment
CREATE OR REPLACE FUNCTION public.can_mentee_book_mentor(_mentee uuid, _mentor uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Free mode: mentor not part of any program → anyone can book
    NOT EXISTS (SELECT 1 FROM public.program_mentors WHERE mentor_id = _mentor)
    OR
    -- Program mode: mentee is in at least one common program with this mentor
    EXISTS (
      SELECT 1
      FROM public.program_mentors pm
      JOIN public.program_mentees pme ON pme.program_id = pm.program_id
      WHERE pm.mentor_id = _mentor
        AND pme.mentee_id = _mentee
    )
    OR
    -- Explicit assignment (backward compat)
    EXISTS (
      SELECT 1 FROM public.mentor_mentee_assignments
      WHERE mentor_id = _mentor AND mentee_id = _mentee
    )
$$;
