-- Mentee ratings, action items and resumes (used by mentorle.in's My sessions and Account pages and by the
-- platform's own screens).
--
--   feedback                  mentees rate only sessions that are completed (the rating screens only offer it
--                             there; the database accepted any of the mentee's sessions).
--   session_action_items      mentees may tick items done and add or remove their own files, nothing else (the
--                             update policy let them rewrite the mentor's title, description and due date).
--   session-attachments       mentee uploads checked the mentor's setting by reading mentor_profiles, which
--                             signed-in users can't read since 20261025120000, so every mentee upload was refused;
--                             it now asks mentor_allows_mentee_attachments() like the screens do.
--   mentee-resumes            the bucket is private but nobody except the mentee and admins could read it, so
--                             mentors couldn't open a mentee's resume. Mentors who have a session or a program
--                             with the mentee can now read it (through a signed link).
--
-- Rollback: supabase/rollbacks/20261027130000_mentee_ratings_tasks_resumes.sql

-- --- Ratings: completed sessions only -----------------------------------------------------------------------

DROP POLICY IF EXISTS "Mentees submit mentor feedback" ON public.feedback;
CREATE POLICY "Mentees submit mentor feedback" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = (SELECT auth.uid())
    AND audience = 'mentor'::public.feedback_audience
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = feedback.session_id AND s.mentee_id = (SELECT auth.uid()) AND s.status = 'completed'
    )
  );

-- --- Action items: what a mentee may change --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_mentee_action_item_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR uid <> OLD.mentee_id OR uid = OLD.mentor_id OR public.has_role(uid, 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.session_id IS DISTINCT FROM OLD.session_id
     OR NEW.mentor_id IS DISTINCT FROM OLD.mentor_id
     OR NEW.mentee_id IS DISTINCT FROM OLD.mentee_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.mentor_attachments IS DISTINCT FROM OLD.mentor_attachments THEN
    RAISE EXCEPTION 'Only your mentor can edit this action item' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_mentee_action_item_update_trg ON public.session_action_items;
CREATE TRIGGER guard_mentee_action_item_update_trg
  BEFORE UPDATE ON public.session_action_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_mentee_action_item_update();

-- --- Session attachments: mentee uploads -----------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can upload session attachments" ON storage.objects;
CREATE POLICY "Users can upload session attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'session-attachments'
    AND (storage.foldername(name))[2] = (auth.uid())::text
    AND (
      EXISTS (
        SELECT 1 FROM public.sessions s
        WHERE s.id = ((storage.foldername(objects.name))[1])::uuid AND s.mentor_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.sessions s
        WHERE s.id = ((storage.foldername(objects.name))[1])::uuid
          AND s.mentee_id = auth.uid()
          AND public.mentor_allows_mentee_attachments(s.mentor_id)
      )
    )
  );

-- --- Mentee resumes: readable by their mentors -----------------------------------------------------------------

DROP POLICY IF EXISTS "mentee_resume_read_mentor" ON storage.objects;
CREATE POLICY "mentee_resume_read_mentor" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mentee-resumes'
    AND (storage.foldername(name))[1] = 'resumes'
    AND (
      EXISTS (
        SELECT 1 FROM public.sessions s
        WHERE s.mentor_id = auth.uid() AND s.mentee_id::text = (storage.foldername(name))[2]
      )
      OR EXISTS (
        SELECT 1 FROM public.program_mentors pmt
        JOIN public.program_mentees pme ON pme.program_id = pmt.program_id
        WHERE pmt.mentor_id = auth.uid() AND pme.mentee_id::text = (storage.foldername(name))[2]
      )
    )
  );
