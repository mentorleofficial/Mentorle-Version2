-- 1. Add soft-delete columns to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_by uuid;

CREATE INDEX IF NOT EXISTS idx_users_is_disabled ON public.users(is_disabled) WHERE is_disabled = true;

-- 2. When a user is soft-deleted, deactivate their mentor profile if they have one
CREATE OR REPLACE FUNCTION public.handle_user_disabled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_disabled = true AND (OLD.is_disabled IS DISTINCT FROM NEW.is_disabled) THEN
    NEW.disabled_at := COALESCE(NEW.disabled_at, now());
    UPDATE public.mentor_profiles SET is_active = false WHERE user_id = NEW.id;
  ELSIF NEW.is_disabled = false AND (OLD.is_disabled IS DISTINCT FROM NEW.is_disabled) THEN
    NEW.disabled_at := NULL;
    NEW.disabled_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_disabled ON public.users;
CREATE TRIGGER trg_users_disabled
BEFORE UPDATE OF is_disabled ON public.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_disabled();

-- 3. Update RLS policies that expose users to peers — hide disabled
DROP POLICY IF EXISTS "Mentees read users of program mentors" ON public.users;
CREATE POLICY "Mentees read users of program mentors"
ON public.users FOR SELECT TO authenticated
USING (
  is_disabled = false
  AND EXISTS (
    SELECT 1 FROM (program_mentors pmt
      JOIN program_mentees pme ON pme.program_id = pmt.program_id)
    WHERE pmt.mentor_id = users.id AND pme.mentee_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Mentors read users of program mentees" ON public.users;
CREATE POLICY "Mentors read users of program mentees"
ON public.users FOR SELECT TO authenticated
USING (
  is_disabled = false
  AND EXISTS (
    SELECT 1 FROM (program_mentees pm
      JOIN program_mentors pmt ON pmt.program_id = pm.program_id)
    WHERE pm.mentee_id = users.id AND pmt.mentor_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Public read active mentor users" ON public.users;
CREATE POLICY "Public read active mentor users"
ON public.users FOR SELECT TO anon, authenticated
USING (
  is_disabled = false
  AND EXISTS (
    SELECT 1 FROM mentor_profiles mp
    WHERE mp.user_id = users.id AND mp.is_active = true
  )
);

-- 4. Cascade cleanup: when removing a program mentor, drop their assignments in that program
CREATE OR REPLACE FUNCTION public.cleanup_program_mentor_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.mentor_mentee_assignments
  WHERE program_id = OLD.program_id AND mentor_id = OLD.mentor_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_program_mentors_cleanup ON public.program_mentors;
CREATE TRIGGER trg_program_mentors_cleanup
AFTER DELETE ON public.program_mentors
FOR EACH ROW EXECUTE FUNCTION public.cleanup_program_mentor_assignments();

-- 5. Cascade cleanup: when removing a program mentee, drop their assignment
CREATE OR REPLACE FUNCTION public.cleanup_program_mentee_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.mentor_mentee_assignments
  WHERE program_id = OLD.program_id AND mentee_id = OLD.mentee_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_program_mentees_cleanup ON public.program_mentees;
CREATE TRIGGER trg_program_mentees_cleanup
AFTER DELETE ON public.program_mentees
FOR EACH ROW EXECUTE FUNCTION public.cleanup_program_mentee_assignments();