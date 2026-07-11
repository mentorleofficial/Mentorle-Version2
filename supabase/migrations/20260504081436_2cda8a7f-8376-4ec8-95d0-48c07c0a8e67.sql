-- 1. New columns on sessions
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS mentee_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meeting_url text NOT NULL DEFAULT '';

-- 2. Partial unique index: one mentor cannot have two booked sessions at the exact same start time
CREATE UNIQUE INDEX IF NOT EXISTS sessions_mentor_slot_unique
  ON public.sessions (mentor_id, scheduled_at)
  WHERE status = 'booked';

-- 3. Overlap-prevention trigger
CREATE OR REPLACE FUNCTION public.prevent_session_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_end timestamptz;
BEGIN
  IF NEW.status <> 'booked' THEN
    RETURN NEW;
  END IF;

  new_end := NEW.scheduled_at + (NEW.duration_minutes || ' minutes')::interval;

  -- Mentor overlap
  IF EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id <> NEW.id
      AND s.mentor_id = NEW.mentor_id
      AND s.status = 'booked'
      AND s.scheduled_at < new_end
      AND (s.scheduled_at + (s.duration_minutes || ' minutes')::interval) > NEW.scheduled_at
  ) THEN
    RAISE EXCEPTION 'Mentor already has a booked session overlapping this time slot' USING ERRCODE = '23P01';
  END IF;

  -- Mentee overlap
  IF EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id <> NEW.id
      AND s.mentee_id = NEW.mentee_id
      AND s.status = 'booked'
      AND s.scheduled_at < new_end
      AND (s.scheduled_at + (s.duration_minutes || ' minutes')::interval) > NEW.scheduled_at
  ) THEN
    RAISE EXCEPTION 'You already have a booked session overlapping this time slot' USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_session_overlap_trg ON public.sessions;
CREATE TRIGGER prevent_session_overlap_trg
  BEFORE INSERT OR UPDATE OF scheduled_at, duration_minutes, status, mentor_id, mentee_id
  ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_session_overlap();

-- 4. RLS: allow mentees to cancel their own sessions
DROP POLICY IF EXISTS "Mentees cancel own sessions" ON public.sessions;
CREATE POLICY "Mentees cancel own sessions"
ON public.sessions
FOR UPDATE
TO authenticated
USING (mentee_id = auth.uid())
WITH CHECK (mentee_id = auth.uid() AND status = 'cancelled');

-- helpful index for admin queries
CREATE INDEX IF NOT EXISTS sessions_scheduled_at_idx ON public.sessions (scheduled_at DESC);
CREATE INDEX IF NOT EXISTS sessions_status_idx ON public.sessions (status);