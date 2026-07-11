DROP FUNCTION IF EXISTS public.list_public_mentors();

CREATE OR REPLACE FUNCTION public.list_public_mentors()
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