
DROP POLICY IF EXISTS "Public read minimal active mentor users" ON public.users;
DROP VIEW IF EXISTS public.public_mentor_users;

CREATE OR REPLACE FUNCTION public.get_public_mentor(_slug_or_id text)
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
  experiences jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id, mp.slug, u.full_name, u.avatar_url,
    mp.headline, mp.bio, mp.expertise, mp.years_experience,
    mp.current_organization, mp.current_role,
    mp.linkedin_url, mp.portfolio_url,
    mp.qualifications, mp.experiences
  FROM public.mentor_profiles mp
  JOIN public.users u ON u.id = mp.user_id
  WHERE mp.is_active = true
    AND u.is_disabled = false
    AND (
      mp.slug = _slug_or_id
      OR (
        _slug_or_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND mp.user_id = _slug_or_id::uuid
      )
    )
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_mentor(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_mentor(text) TO anon, authenticated;

-- Also a list function for the directory
CREATE OR REPLACE FUNCTION public.list_public_mentors()
RETURNS TABLE (
  user_id uuid,
  slug text,
  full_name text,
  avatar_url text,
  headline text,
  bio text,
  expertise text[],
  years_experience integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, mp.slug, u.full_name, u.avatar_url,
         mp.headline, mp.bio, mp.expertise, mp.years_experience
  FROM public.mentor_profiles mp
  JOIN public.users u ON u.id = mp.user_id
  WHERE mp.is_active = true AND u.is_disabled = false
$$;

REVOKE EXECUTE ON FUNCTION public.list_public_mentors() FROM public;
GRANT EXECUTE ON FUNCTION public.list_public_mentors() TO anon, authenticated;
