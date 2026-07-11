-- Helper: is the user a mentor of the given program?
CREATE OR REPLACE FUNCTION public.is_program_mentor(_program_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.program_mentors
    WHERE program_id = _program_id AND mentor_id = _user_id
  );
$$;

-- Allow mentors of a program to read its program_mentees rows
CREATE POLICY "Mentors read mentees in their programs"
ON public.program_mentees
FOR SELECT
TO authenticated
USING (public.is_program_mentor(program_id, auth.uid()));

-- Allow mentors to read user records of mentees enrolled in their programs
CREATE POLICY "Mentors read users of program mentees"
ON public.users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.program_mentees pm
    JOIN public.program_mentors pmt ON pmt.program_id = pm.program_id
    WHERE pm.mentee_id = users.id
      AND pmt.mentor_id = auth.uid()
  )
);