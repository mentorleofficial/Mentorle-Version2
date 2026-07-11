
ALTER TABLE public.mentor_profiles
  ADD COLUMN IF NOT EXISTS approval_acknowledged_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS slug text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mentor_profiles_slug_unique
  ON public.mentor_profiles (slug)
  WHERE slug IS NOT NULL;

-- Allow anonymous + authenticated to read ACTIVE mentor profiles (public profile page + LinkedIn previews)
DROP POLICY IF EXISTS "Public read active mentor profiles" ON public.mentor_profiles;
CREATE POLICY "Public read active mentor profiles"
ON public.mentor_profiles
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Allow anonymous + authenticated to read basic info of users who are active mentors
DROP POLICY IF EXISTS "Public read active mentor users" ON public.users;
CREATE POLICY "Public read active mentor users"
ON public.users
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.mentor_profiles mp
    WHERE mp.user_id = users.id AND mp.is_active = true
  )
);
