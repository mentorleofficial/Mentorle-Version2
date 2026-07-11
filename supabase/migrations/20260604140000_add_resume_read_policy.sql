-- Allow authenticated mentors to read their own resume from storage, even if the path starts with 'applications/' instead of their user id.
DROP POLICY IF EXISTS "Mentors read own resume path" ON storage.objects;

CREATE POLICY "Mentors read own resume path"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'mentor-resumes'
  AND EXISTS (
    SELECT 1 FROM public.mentor_profiles mp
    WHERE mp.user_id = auth.uid() AND mp.resume_url = name
  )
);
