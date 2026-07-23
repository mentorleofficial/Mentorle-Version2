-- mentee-resumes was created public (20260614000000) with a {public} SELECT policy
-- scoped only to bucket_id, so anyone could read AND enumerate every mentee resume.
-- Make the bucket private and scope reads to the owning mentee + admins, mirroring
-- the mentor-resumes model. Bucket is currently empty, so no read flow is disrupted.
-- (Upload/update/delete policies already owner-scope on resumes/<uid>/… and are kept.)
UPDATE storage.buckets SET public = false WHERE id = 'mentee-resumes';

DROP POLICY IF EXISTS "mentee_resume_read" ON storage.objects;

CREATE POLICY "mentee_resume_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mentee-resumes'
    AND (storage.foldername(name))[1] = 'resumes'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "mentee_resume_read_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mentee-resumes'
    AND public.has_role(auth.uid(), 'admin')
  );
