-- Mentees can read program_mentors rows for programs they're enrolled in
CREATE POLICY "Mentees read mentors in their programs"
ON public.program_mentors
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.program_mentees pe
    WHERE pe.program_id = program_mentors.program_id
      AND pe.mentee_id = auth.uid()
  )
);

-- Mentees can read user records of mentors who share a program with them
CREATE POLICY "Mentees read users of program mentors"
ON public.users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.program_mentors pmt
    JOIN public.program_mentees pme ON pme.program_id = pmt.program_id
    WHERE pmt.mentor_id = users.id
      AND pme.mentee_id = auth.uid()
  )
);