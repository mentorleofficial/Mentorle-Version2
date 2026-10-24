-- Undo 20261024120000. Drops the admin's homepage picks.
DROP FUNCTION IF EXISTS public.set_featured_mentors(uuid[]);
DROP FUNCTION IF EXISTS public.list_featured_mentors();
DROP TABLE IF EXISTS public.featured_mentors;
