-- Public mentor lookup: allow owner/admin preview of inactive profiles,
-- return is_active so the UI can show a "not live" banner,
-- and backfill any missing slugs.
--
-- IMPORTANT: never cast `_slug_or_id` to uuid directly — Postgres may evaluate
-- the cast for slug inputs (e.g. "sourabh-goyal") and raise 22P02, aborting the query.

DROP FUNCTION IF EXISTS public.get_public_mentor(text);

CREATE FUNCTION public.get_public_mentor(_slug_or_id text)
RETURNS TABLE (
  user_id uuid,
  slug text,
  full_name text,
  avatar_url text,
  headline text,
  bio text,
  expertise text[],
  years_experience integer,
  current_organization text,
  "current_role" text,
  linkedin_url text,
  portfolio_url text,
  qualifications jsonb,
  experiences jsonb,
  is_active boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    mp.slug,
    u.full_name,
    u.avatar_url,
    mp.headline,
    mp.bio,
    mp.expertise,
    mp.years_experience,
    mp.current_organization,
    mp.current_role,
    mp.linkedin_url,
    mp.portfolio_url,
    mp.qualifications,
    mp.experiences,
    mp.is_active
  FROM public.mentor_profiles mp
  JOIN public.users u ON u.id = mp.user_id
  WHERE u.is_disabled = false
    AND (
      -- Live mentors are public to everyone (anon + authenticated)
      mp.is_active = true
      -- Owner can always open their own public URL (preview when not live)
      OR mp.user_id = auth.uid()
      -- Admins can open any mentor public URL for review
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
    AND (
      mp.slug = _slug_or_id
      OR mp.user_id::text = lower(_slug_or_id)
    )
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_mentor(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_mentor(text) TO anon, authenticated;

-- Admins need this when activating a mentor without a slug
GRANT EXECUTE ON FUNCTION public.generate_mentor_slug(text, uuid) TO authenticated;

-- Backfill missing slugs for all mentor profiles
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT mp.user_id, u.full_name
    FROM public.mentor_profiles mp
    JOIN public.users u ON u.id = mp.user_id
    WHERE mp.slug IS NULL OR mp.slug = ''
  LOOP
    UPDATE public.mentor_profiles
    SET slug = public.generate_mentor_slug(r.full_name, r.user_id)
    WHERE user_id = r.user_id;
  END LOOP;
END $$;
