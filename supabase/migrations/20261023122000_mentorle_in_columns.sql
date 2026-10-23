-- Columns the mentee site (mentorle.in) reads or writes. All nullable or defaulted, so the platform's
-- existing screens and inserts keep working unchanged.
--
--   events_programs.slug        — event detail URLs (/events/<slug>). Backfilled from the title, unique,
--                                  generated on insert when the creator doesn't set one.
--   events_programs.subtitle    — one-line summary under the event title.
--   events_programs.highlights  — short bullet points on the event page.
--   mentee_profiles.date_of_birth, .marketing_opt_in — collected by mentorle.in onboarding.
--   mentor_profiles.domain      — Find a Mentor filter tabs (IT & Software / Startups / Academics).
--   list_public_mentors()       — now also returns current_organization and domain for the directory cards.

-- --- Events ----------------------------------------------------------------------------------------------

ALTER TABLE public.events_programs
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS highlights text[] NOT NULL DEFAULT '{}';

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
  base := left(base, 80);
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

REVOKE EXECUTE ON FUNCTION public.generate_event_slug(text, uuid) FROM public, anon;

CREATE OR REPLACE FUNCTION public.set_event_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    NEW.slug := public.generate_event_slug(NEW.title, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_event_slug ON public.events_programs;
CREATE TRIGGER set_event_slug
  BEFORE INSERT OR UPDATE OF slug ON public.events_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_event_slug();

-- Backfill oldest first, so the earliest event with a given title keeps the plain slug.
DO $$
DECLARE
  ev record;
BEGIN
  FOR ev IN SELECT id, title FROM public.events_programs WHERE slug IS NULL ORDER BY created_at NULLS FIRST, id LOOP
    UPDATE public.events_programs SET slug = public.generate_event_slug(ev.title, ev.id) WHERE id = ev.id;
  END LOOP;
END;
$$;

ALTER TABLE public.events_programs ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS events_programs_slug_key ON public.events_programs (slug);

-- --- Mentee profiles -------------------------------------------------------------------------------------

ALTER TABLE public.mentee_profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;

-- --- Mentor profiles -------------------------------------------------------------------------------------

ALTER TABLE public.mentor_profiles
  ADD COLUMN IF NOT EXISTS domain text;

ALTER TABLE public.mentor_profiles DROP CONSTRAINT IF EXISTS mentor_profiles_domain_check;
ALTER TABLE public.mentor_profiles
  ADD CONSTRAINT mentor_profiles_domain_check
  CHECK (domain IS NULL OR domain IN ('it-software', 'startups', 'academics'));

-- The return type changes, so the function has to be dropped and recreated (and re-granted).
DROP FUNCTION IF EXISTS public.list_public_mentors();

CREATE FUNCTION public.list_public_mentors()
RETURNS TABLE (
  user_id uuid,
  slug text,
  full_name text,
  avatar_url text,
  headline text,
  bio text,
  expertise text[],
  years_experience integer,
  "current_role" text,
  current_organization text,
  domain text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, mp.slug, u.full_name, u.avatar_url,
         mp.headline, mp.bio, mp.expertise, mp.years_experience,
         mp.current_role, mp.current_organization, mp.domain
  FROM public.mentor_profiles mp
  JOIN public.users u ON u.id = mp.user_id
  WHERE mp.is_active = true
    AND u.is_disabled = false;
$$;

REVOKE EXECUTE ON FUNCTION public.list_public_mentors() FROM public;
GRANT EXECUTE ON FUNCTION public.list_public_mentors() TO anon, authenticated;
