-- Undo 20261023122000. Drops the new columns and any data written to them (event slugs/subtitles/highlights,
-- mentee date of birth and marketing consent, mentor domain).
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
  "current_role" text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, mp.slug, u.full_name, u.avatar_url,
         mp.headline, mp.bio, mp.expertise, mp.years_experience,
         mp.current_role
  FROM public.mentor_profiles mp
  JOIN public.users u ON u.id = mp.user_id
  WHERE mp.is_active = true
    AND u.is_disabled = false;
$$;
REVOKE EXECUTE ON FUNCTION public.list_public_mentors() FROM public;
GRANT EXECUTE ON FUNCTION public.list_public_mentors() TO anon, authenticated;

ALTER TABLE public.mentor_profiles DROP CONSTRAINT IF EXISTS mentor_profiles_domain_check;
ALTER TABLE public.mentor_profiles DROP COLUMN IF EXISTS domain;

ALTER TABLE public.mentee_profiles
  DROP COLUMN IF EXISTS date_of_birth,
  DROP COLUMN IF EXISTS marketing_opt_in;

DROP TRIGGER IF EXISTS set_event_slug ON public.events_programs;
DROP FUNCTION IF EXISTS public.set_event_slug();
DROP FUNCTION IF EXISTS public.generate_event_slug(text, uuid);
DROP INDEX IF EXISTS public.events_programs_slug_key;
ALTER TABLE public.events_programs
  DROP COLUMN IF EXISTS slug,
  DROP COLUMN IF EXISTS subtitle,
  DROP COLUMN IF EXISTS highlights;
