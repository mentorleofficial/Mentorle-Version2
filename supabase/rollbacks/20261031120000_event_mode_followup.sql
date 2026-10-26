-- Rollback for 20261031120000_event_mode_followup.sql: only the delete function is new; the two others are the
-- current versions from 20261030120000 (roll that one back to remove them).
DROP FUNCTION IF EXISTS public.event_mode_delete(uuid);
