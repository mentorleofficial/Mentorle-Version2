-- Add policy to allow authenticated users to update their own mentor applications
CREATE POLICY "Applicants update own applications"
ON public.mentor_applications FOR UPDATE
TO authenticated
USING (lower(email) = lower(auth.jwt() ->> 'email'))
WITH CHECK (lower(email) = lower(auth.jwt() ->> 'email'));
