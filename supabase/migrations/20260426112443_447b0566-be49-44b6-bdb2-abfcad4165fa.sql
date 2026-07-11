
-- =========================================================
-- 1. PROGRAMS
-- =========================================================
CREATE TABLE public.programs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  starts_on   date,
  ends_on     date,
  capacity    integer,
  color       text NOT NULL DEFAULT '221 83% 53%',
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER programs_set_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE POLICY "Admins full access on programs"
  ON public.programs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- mentors / mentees can read programs they're part of (policies added below after helper)

-- =========================================================
-- 2. PROGRAM TAGS
-- =========================================================
CREATE TABLE public.program_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  label      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX program_tags_unique_label
  ON public.program_tags (program_id, lower(label));

CREATE POLICY "Admins full access on program_tags"
  ON public.program_tags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read program_tags"
  ON public.program_tags FOR SELECT TO authenticated
  USING (true);

-- =========================================================
-- 3. PROGRAM MENTORS
-- =========================================================
CREATE TABLE public.program_mentors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  mentor_id   uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, mentor_id)
);
CREATE INDEX idx_program_mentors_mentor ON public.program_mentors(mentor_id);

CREATE POLICY "Admins full access on program_mentors"
  ON public.program_mentors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Mentors read own program memberships"
  ON public.program_mentors FOR SELECT TO authenticated
  USING (mentor_id = auth.uid());

-- =========================================================
-- 4. PROGRAM MENTEES
-- =========================================================
CREATE TABLE public.program_mentees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  mentee_id   uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, mentee_id)
);
CREATE INDEX idx_program_mentees_mentee ON public.program_mentees(mentee_id);

CREATE POLICY "Admins full access on program_mentees"
  ON public.program_mentees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Mentees read own program enrollments"
  ON public.program_mentees FOR SELECT TO authenticated
  USING (mentee_id = auth.uid());

-- =========================================================
-- 5. MENTOR ↔ MENTEE ASSIGNMENTS
-- =========================================================
CREATE TABLE public.mentor_mentee_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  mentor_id   uuid NOT NULL,
  mentee_id   uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  notes       text NOT NULL DEFAULT '',
  UNIQUE (program_id, mentee_id)
);
CREATE INDEX idx_mma_program_mentor ON public.mentor_mentee_assignments(program_id, mentor_id);
CREATE INDEX idx_mma_mentee ON public.mentor_mentee_assignments(mentee_id);
CREATE INDEX idx_mma_mentor ON public.mentor_mentee_assignments(mentor_id);

CREATE POLICY "Admins full access on mentor_mentee_assignments"
  ON public.mentor_mentee_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Mentors read own assignments"
  ON public.mentor_mentee_assignments FOR SELECT TO authenticated
  USING (mentor_id = auth.uid());

CREATE POLICY "Mentees read own assignment"
  ON public.mentor_mentee_assignments FOR SELECT TO authenticated
  USING (mentee_id = auth.uid());

-- =========================================================
-- 6. INTEGRITY TRIGGER: assignment must reference enrolled members
-- =========================================================
CREATE OR REPLACE FUNCTION public.validate_mentor_mentee_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE TRIGGER mma_validate
  BEFORE INSERT OR UPDATE ON public.mentor_mentee_assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_mentor_mentee_assignment();

-- =========================================================
-- 7. PROGRAM READ POLICIES FOR MEMBERS (after helper tables exist)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_program_member(_program_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.program_mentors WHERE program_id = _program_id AND mentor_id = _user_id)
    OR
    EXISTS (SELECT 1 FROM public.program_mentees WHERE program_id = _program_id AND mentee_id = _user_id)
$$;

CREATE POLICY "Members read their programs"
  ON public.programs FOR SELECT TO authenticated
  USING (public.is_program_member(id, auth.uid()));

-- =========================================================
-- 8. BOOKING GUARD: mentee can only book mapped mentor (if mentor is in any program)
-- =========================================================
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
    -- Mapped mode: explicit assignment exists
    EXISTS (
      SELECT 1 FROM public.mentor_mentee_assignments
      WHERE mentor_id = _mentor AND mentee_id = _mentee
    )
$$;

DROP POLICY IF EXISTS "Mentees book sessions" ON public.sessions;
CREATE POLICY "Mentees book sessions"
  ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (
    mentee_id = auth.uid()
    AND public.can_mentee_book_mentor(auth.uid(), mentor_id)
  );

-- =========================================================
-- 9. AUDIT TRIGGERS
-- =========================================================
CREATE TRIGGER audit_programs
  AFTER INSERT OR UPDATE OR DELETE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_program_tags
  AFTER INSERT OR UPDATE OR DELETE ON public.program_tags
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_program_mentors
  AFTER INSERT OR UPDATE OR DELETE ON public.program_mentors
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_program_mentees
  AFTER INSERT OR UPDATE OR DELETE ON public.program_mentees
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_mma
  AFTER INSERT OR UPDATE OR DELETE ON public.mentor_mentee_assignments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
