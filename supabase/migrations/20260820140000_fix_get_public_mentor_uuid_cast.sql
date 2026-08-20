-- Fix get_public_mentor: Postgres may evaluate `_slug_or_id::uuid` even when the
-- value is a slug (e.g. "sourabh-goyal"), which raises 22P02 and returns nothing.
-- Match UUID via text compare / CASE so slug lookups never cast.

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
      mp.is_active = true
      OR mp.user_id = auth.uid()
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
