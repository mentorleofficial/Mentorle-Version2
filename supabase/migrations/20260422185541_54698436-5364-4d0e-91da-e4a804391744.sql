
-- Add WITH CHECK to admin ALL policies so admin INSERT/UPDATE pass
DROP POLICY IF EXISTS "Admins full access on mentor_profiles" ON public.mentor_profiles;
CREATE POLICY "Admins full access on mentor_profiles"
ON public.mentor_profiles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins full access on users" ON public.users;
CREATE POLICY "Admins full access on users"
ON public.users
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Storage: allow owners to read/update/delete their own resumes in mentor-resumes
DROP POLICY IF EXISTS "Users read own resume" ON storage.objects;
CREATE POLICY "Users read own resume"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'mentor-resumes'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

DROP POLICY IF EXISTS "Users update own resume" ON storage.objects;
CREATE POLICY "Users update own resume"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'mentor-resumes'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'mentor-resumes'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

DROP POLICY IF EXISTS "Users delete own resume" ON storage.objects;
CREATE POLICY "Users delete own resume"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'mentor-resumes'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Tighten "Anyone can upload resume" → only owner-scoped path
DROP POLICY IF EXISTS "Anyone can upload resume" ON storage.objects;
CREATE POLICY "Users upload own resume"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'mentor-resumes'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
