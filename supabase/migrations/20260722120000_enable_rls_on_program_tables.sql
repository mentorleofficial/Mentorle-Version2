-- Migration 20260426112443 created these 5 tables WITH policies but never ran
-- ENABLE ROW LEVEL SECURITY, so the policies were dormant and anon/authenticated
-- kept the default GRANT ALL: full public read/insert/update/delete on live data.
--
-- The original policies only allow SELF reads (mentor_id=auth.uid() / mentee_id=auth.uid()),
-- but the app reads ACROSS roles within a shared program:
--   * a mentor lists the mentees enrolled in their programs (program_mentees)
--   * a mentee lists the mentors of programs they're in (program_mentors)
-- Enabling RLS with only the self-read policies would return 0 rows for those flows.
-- We therefore also add two membership-scoped read policies, using SECURITY DEFINER
-- helpers so the policy sub-queries don't recurse into RLS on the same tables.

CREATE OR REPLACE FUNCTION public.is_program_mentor(_program_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.program_mentors
    WHERE program_id = _program_id AND mentor_id = _user_id
  )
$$;

-- Mentors read the mentee roster of any program they mentor.
CREATE POLICY "Program mentors read program mentees"
  ON public.program_mentees FOR SELECT TO authenticated
  USING (public.is_program_mentor(program_id, auth.uid()));

-- Any program member (mentor or mentee) reads the full mentor list of that program.
-- is_program_member already exists and is SECURITY DEFINER (migration 20260426112443).
CREATE POLICY "Program members read program mentors"
  ON public.program_mentors FOR SELECT TO authenticated
  USING (public.is_program_member(program_id, auth.uid()));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'programs','program_tags','program_mentors','program_mentees','mentor_mentee_assignments'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
