
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS response text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_feedback_subject(_feedback_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.feedback f
    JOIN public.sessions s ON s.id = f.session_id
    WHERE f.id = _feedback_id
      AND (
        (f.audience = 'mentor' AND s.mentor_id = _user_id)
        OR (f.audience = 'mentee' AND s.mentee_id = _user_id)
      )
  );
$$;

DROP POLICY IF EXISTS "Subject can view feedback about them" ON public.feedback;
CREATE POLICY "Subject can view feedback about them"
ON public.feedback
FOR SELECT
TO authenticated
USING (public.is_feedback_subject(id, auth.uid()));

DROP POLICY IF EXISTS "Subject can respond to feedback about them" ON public.feedback;
CREATE POLICY "Subject can respond to feedback about them"
ON public.feedback
FOR UPDATE
TO authenticated
USING (public.is_feedback_subject(id, auth.uid()))
WITH CHECK (public.is_feedback_subject(id, auth.uid()));
