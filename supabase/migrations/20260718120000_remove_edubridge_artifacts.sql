-- Mentorle no longer syncs to EduBridge: the sync function, admin tab, and the
-- outbound_events writer in approve-mentor-application are all removed from the repo.
-- Drop the now-orphaned artifacts (edubridge_enabled was false; webhook URL empty).
ALTER TABLE public.branding
  DROP COLUMN IF EXISTS edubridge_enabled,
  DROP COLUMN IF EXISTS edubridge_webhook_url;

DROP TABLE IF EXISTS public.outbound_events;
