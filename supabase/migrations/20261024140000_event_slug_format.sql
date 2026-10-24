-- Event web addresses (events_programs.slug, used by mentorle.in/events/<slug>) are now editable in the event
-- form. Keep them URL-safe even for direct database edits: lowercase letters and digits in groups joined by
-- single hyphens. Generated slugs (generate_event_slug) already have this shape.

ALTER TABLE public.events_programs DROP CONSTRAINT IF EXISTS events_programs_slug_format;
ALTER TABLE public.events_programs
  ADD CONSTRAINT events_programs_slug_format
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80);

-- The generator capped the base at 80 characters and then appended "-2", "-3"…, which could pass 80. Cap the
-- base at 70 so a suffix always fits.
CREATE OR REPLACE FUNCTION public.generate_event_slug(_title text, _event_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  n integer := 1;
BEGIN
  base := lower(coalesce(_title, 'event'));
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := regexp_replace(base, '(^-+|-+$)', '', 'g');
  base := left(base, 70);
  base := regexp_replace(base, '-+$', '', 'g');
  IF base = '' OR base IS NULL THEN
    base := 'event';
  END IF;

  candidate := base;
  WHILE EXISTS (
    SELECT 1 FROM public.events_programs
    WHERE slug = candidate AND id IS DISTINCT FROM _event_id
  ) LOOP
    n := n + 1;
    candidate := base || '-' || n;
  END LOOP;
  RETURN candidate;
END;
$$;
