-- Rollback for 20261027130000_mentee_ratings_tasks_resumes.sql: the previous policies, no action-item guard.

DROP POLICY IF EXISTS "Mentees submit mentor feedback" ON public.feedback;
CREATE POLICY "Mentees submit mentor feedback" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = (SELECT auth.uid())
    AND audience = 'mentor'::public.feedback_audience
    AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = feedback.session_id AND s.mentee_id = (SELECT auth.uid()))
  );

DROP TRIGGER IF EXISTS guard_mentee_action_item_update_trg ON public.session_action_items;
DROP FUNCTION IF EXISTS public.guard_mentee_action_item_update();

DROP POLICY IF EXISTS "Users can upload session attachments" ON storage.objects;
CREATE POLICY "Users can upload session attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'session-attachments'
    AND (storage.foldername(name))[2] = (auth.uid())::text
    AND (
      EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = ((storage.foldername(objects.name))[1])::uuid AND s.mentor_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.sessions s JOIN public.mentor_profiles mp ON s.mentor_id = mp.user_id
        WHERE s.id = ((storage.foldername(objects.name))[1])::uuid AND s.mentee_id = auth.uid() AND mp.allow_mentee_attachments = true
      )
    )
  );

DROP POLICY IF EXISTS "mentee_resume_read_mentor" ON storage.objects;
