-- 1. Redefine can_mentee_book_mentor to allow booking any active, non-disabled mentor
CREATE OR REPLACE FUNCTION public.can_mentee_book_mentor(_mentee uuid, _mentor uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.mentor_profiles mp
    JOIN public.users u ON u.id = mp.user_id
    WHERE mp.user_id = _mentor
      AND mp.is_active = true
      AND u.is_disabled = false
  );
$$;

-- 2. Redefine list_public_mentors to return all active, non-disabled mentors (no program/assignment restriction)
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
  WHERE mp.is_active = true 
    AND u.is_disabled = false;
$$;
