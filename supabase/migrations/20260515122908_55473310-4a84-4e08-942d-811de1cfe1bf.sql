
-- Audience enum
DO $$ BEGIN
  CREATE TYPE public.feedback_audience AS ENUM ('mentor', 'mentee', 'admin_private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add audience column
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS audience public.feedback_audience NOT NULL DEFAULT 'mentor';

-- One feedback per (session, submitter, audience)
CREATE UNIQUE INDEX IF NOT EXISTS feedback_session_submitter_audience_uniq
  ON public.feedback (session_id, submitted_by, audience);

-- Drop old policies we will replace
DROP POLICY IF EXISTS "Users submit own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users read feedback on own sessions" ON public.feedback;

-- Mentee submits 'mentor' (about the mentor) on own session
CREATE POLICY "Mentees submit mentor feedback"
ON public.feedback FOR INSERT TO authenticated
WITH CHECK (
  submitted_by = auth.uid()
  AND audience = 'mentor'
  AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.mentee_id = auth.uid())
);

-- Mentor submits 'mentee' or 'admin_private' on own session
CREATE POLICY "Mentors submit mentee feedback"
ON public.feedback FOR INSERT TO authenticated
WITH CHECK (
  submitted_by = auth.uid()
  AND audience IN ('mentee', 'admin_private')
  AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.mentor_id = auth.uid())
);

-- Mentor reads feedback about themselves (audience='mentor') on own sessions
CREATE POLICY "Mentors read feedback about them"
ON public.feedback FOR SELECT TO authenticated
USING (
  audience = 'mentor'
  AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.mentor_id = auth.uid())
);

-- Mentee reads feedback about themselves (audience='mentee') on own sessions
CREATE POLICY "Mentees read feedback about them"
ON public.feedback FOR SELECT TO authenticated
USING (
  audience = 'mentee'
  AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.mentee_id = auth.uid())
);

-- Anyone involved in the session can read what they themselves submitted
CREATE POLICY "Users read own submitted feedback"
ON public.feedback FOR SELECT TO authenticated
USING (submitted_by = auth.uid());

-- Public aggregate: allow anonymous read of audience='mentor' for active mentors so the public profile can compute averages
CREATE POLICY "Public read mentor-audience feedback for active mentors"
ON public.feedback FOR SELECT TO anon, authenticated
USING (
  audience = 'mentor'
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.mentor_profiles mp ON mp.user_id = s.mentor_id
    WHERE s.id = feedback.session_id AND mp.is_active = true
  )
);
