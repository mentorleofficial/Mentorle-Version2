-- Migration: Add reschedule tracking and privacy policy markdown content

-- 1. Add rescheduled_from_id to public.sessions
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS rescheduled_from_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_rescheduled_from_id ON public.sessions (rescheduled_from_id);

-- 2. Add content to public.privacy_policy
ALTER TABLE public.privacy_policy
  ADD COLUMN IF NOT EXISTS content text NOT NULL DEFAULT '';
