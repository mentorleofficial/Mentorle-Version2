-- Create mentee-resumes storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mentee-resumes',
  'mentee-resumes',
  true,
  10485760,  -- 10 MB
  ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload their own resumes
CREATE POLICY "mentee_resume_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mentee-resumes' AND (storage.foldername(name))[1] = 'resumes' AND (storage.foldername(name))[2] = auth.uid()::text);

-- Authenticated users can update (upsert) their own resumes
CREATE POLICY "mentee_resume_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'mentee-resumes' AND (storage.foldername(name))[1] = 'resumes' AND (storage.foldername(name))[2] = auth.uid()::text);

-- Authenticated users can delete their own resumes
CREATE POLICY "mentee_resume_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'mentee-resumes' AND (storage.foldername(name))[1] = 'resumes' AND (storage.foldername(name))[2] = auth.uid()::text);

-- Anyone can read (public bucket)
CREATE POLICY "mentee_resume_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'mentee-resumes');
