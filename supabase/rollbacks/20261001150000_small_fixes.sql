-- Undo 20261001150000. Re-apply notify_application_event from
-- db backup/2026-10-01/schema.sql if its email matching must be reverted too.
GRANT SELECT ON public.users TO anon;
GRANT SELECT ON public.mentor_profiles TO anon;
