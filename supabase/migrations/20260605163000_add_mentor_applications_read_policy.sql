-- Add policy to allow authenticated users to read their own mentor applications
CREATE POLICY "Applicants read own applications"
ON public.mentor_applications FOR SELECT
TO authenticated
USING (lower(email) = lower(auth.jwt() ->> 'email'));
