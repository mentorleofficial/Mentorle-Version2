-- Undo 20261024140000.
ALTER TABLE public.events_programs DROP CONSTRAINT IF EXISTS events_programs_slug_format;
-- generate_event_slug keeps its 70-character base (harmless; the 80-character version is in 20261023122000).
