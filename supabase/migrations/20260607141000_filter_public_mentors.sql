-- Redefine list_public_mentors() to filter out mentors that the current mentee is not allowed to book.
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
    AND u.is_disabled = false
    AND (
      auth.uid() IS NULL
      OR public.has_role(auth.uid(), 'admin')
      OR public.can_mentee_book_mentor(auth.uid(), mp.user_id)
    )
$$;
