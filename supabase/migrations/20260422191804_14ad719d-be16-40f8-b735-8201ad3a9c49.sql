CREATE POLICY "Anonymous can upload application resume"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'mentor-resumes'
  AND array_length(storage.foldername(name), 1) IS NULL
);