
-- Fix mutable search_path on the trigger function
CREATE OR REPLACE FUNCTION public.validate_mentor_mentee_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.program_mentors
    WHERE program_id = NEW.program_id AND mentor_id = NEW.mentor_id
  ) THEN
    RAISE EXCEPTION 'Mentor % is not assigned to program %', NEW.mentor_id, NEW.program_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.program_mentees
    WHERE program_id = NEW.program_id AND mentee_id = NEW.mentee_id
  ) THEN
    RAISE EXCEPTION 'Mentee % is not enrolled in program %', NEW.mentee_id, NEW.program_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Replace permissive program_tags read policy with member-scoped one
DROP POLICY IF EXISTS "Authenticated read program_tags" ON public.program_tags;

CREATE POLICY "Members read program_tags"
  ON public.program_tags FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_program_member(program_id, auth.uid())
  );
