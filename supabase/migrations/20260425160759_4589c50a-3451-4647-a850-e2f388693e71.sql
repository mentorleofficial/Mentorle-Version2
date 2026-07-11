-- Slug generator function
CREATE OR REPLACE FUNCTION public.generate_mentor_slug(_full_name text, _user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
BEGIN
  base := lower(coalesce(_full_name, 'mentor'));
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := regexp_replace(base, '(^-+|-+$)', '', 'g');
  IF base = '' OR base IS NULL THEN
    base := 'mentor';
  END IF;
  candidate := base;
  IF EXISTS (SELECT 1 FROM public.mentor_profiles WHERE slug = candidate AND user_id <> _user_id) THEN
    candidate := base || '-' || substr(_user_id::text, 1, 4);
  END IF;
  RETURN candidate;
END;
$$;

-- Unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS mentor_profiles_slug_unique
  ON public.mentor_profiles (slug)
  WHERE slug IS NOT NULL;

-- Backfill slugs for active mentors missing one
UPDATE public.mentor_profiles mp
SET slug = public.generate_mentor_slug(u.full_name, mp.user_id)
FROM public.users u
WHERE u.id = mp.user_id
  AND (mp.slug IS NULL OR mp.slug = '');