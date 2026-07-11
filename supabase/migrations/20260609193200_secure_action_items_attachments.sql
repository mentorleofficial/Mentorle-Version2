-- Secure storage policies for session-attachments
DROP POLICY IF EXISTS "Session attachments public read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload session attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete session attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload session attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete session attachments" ON storage.objects;

-- 1. Anyone (or authenticated) can view files in the session-attachments bucket
CREATE POLICY "Session attachments public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'session-attachments');

-- 2. Authenticated users can upload to session-attachments only if they are the mentor,
-- or if they are the mentee of the session and the mentor has enabled replies
CREATE POLICY "Users can upload session attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'session-attachments'
    AND (storage.foldername(name))[2] = (auth.uid())::text
    AND (
      -- Mentor of the session
      EXISTS (
        SELECT 1 FROM public.sessions s
        WHERE s.id = (storage.foldername(name))[1]::uuid
          AND s.mentor_id = auth.uid()
      )
      OR
      -- Mentee of the session with allow_mentee_attachments enabled
      EXISTS (
        SELECT 1 FROM public.sessions s
        JOIN public.mentor_profiles mp ON s.mentor_id = mp.user_id
        WHERE s.id = (storage.foldername(name))[1]::uuid
          AND s.mentee_id = auth.uid()
          AND mp.allow_mentee_attachments = true
      )
    )
  );

-- 3. Authenticated users can delete files in session-attachments if they uploaded them (owner folder)
-- or if they are the mentor of the session
CREATE POLICY "Users can delete session attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'session-attachments'
    AND (
      -- User who uploaded the file
      (storage.foldername(name))[2] = (auth.uid())::text
      OR
      -- Mentor of the session
      EXISTS (
        SELECT 1 FROM public.sessions s
        WHERE s.id = (storage.foldername(name))[1]::uuid
          AND s.mentor_id = auth.uid()
      )
    )
  );

-- 4. Restore the standard session_action_items update policy for mentees
DROP POLICY IF EXISTS "Mentees update own action item status" ON public.session_action_items;
CREATE POLICY "Mentees update own action item status"
  ON public.session_action_items
  FOR UPDATE
  TO authenticated
  USING (mentee_id = auth.uid())
  WITH CHECK (mentee_id = auth.uid());

-- 5. Add trigger to enforce that mentees cannot update attachments if the mentor has disabled it
CREATE OR REPLACE FUNCTION public.check_mentee_attachments_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the updater is a mentee
  IF (SELECT role FROM public.users WHERE id = auth.uid()) = 'mentee'::public.app_role THEN
    -- Check if mentee_attachments is being modified
    IF OLD.mentee_attachments IS DISTINCT FROM NEW.mentee_attachments THEN
      -- If the mentor has allow_mentee_attachments disabled, block it
      IF NOT EXISTS (
        SELECT 1 FROM public.mentor_profiles
        WHERE user_id = NEW.mentor_id
          AND allow_mentee_attachments = true
      ) THEN
        RAISE EXCEPTION 'File uploads in replies are disabled by the mentor.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_mentee_attachments_update ON public.session_action_items;
CREATE TRIGGER trg_check_mentee_attachments_update
  BEFORE UPDATE ON public.session_action_items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_mentee_attachments_update();
