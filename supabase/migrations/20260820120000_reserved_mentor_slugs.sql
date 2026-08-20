-- Prevent mentor slugs from colliding with authenticated /mentor/* app routes
-- (profile, offerings, sessions, etc.) when public profiles use /mentor/:slug.

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
  reserved text[] := ARRAY[
    'profile',
    'offerings',
    'sessions',
    'availability',
    'events',
    'mentees',
    'programs',
    'leaderboard',
    'earnings'
  ];
BEGIN
  base := lower(coalesce(_full_name, 'mentor'));
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := regexp_replace(base, '(^-+|-+$)', '', 'g');
  IF base = '' OR base IS NULL THEN
    base := 'mentor';
  END IF;

  -- Avoid reserved app path segments under /mentor/*
  IF base = ANY (reserved) THEN
    base := 'mentor-' || base;
  END IF;

  candidate := base;
  IF EXISTS (SELECT 1 FROM public.mentor_profiles WHERE slug = candidate AND user_id <> _user_id) THEN
    candidate := base || '-' || substr(_user_id::text, 1, 4);
  END IF;
  RETURN candidate;
END;
$$;

-- Re-slug any existing profiles that already use a reserved path segment
DO $$
DECLARE
  r record;
  reserved text[] := ARRAY[
    'profile',
    'offerings',
    'sessions',
    'availability',
    'events',
    'mentees',
    'programs',
    'leaderboard',
    'earnings'
  ];
BEGIN
  FOR r IN
    SELECT mp.user_id, u.full_name
    FROM public.mentor_profiles mp
    JOIN public.users u ON u.id = mp.user_id
    WHERE mp.slug = ANY (reserved)
  LOOP
    UPDATE public.mentor_profiles
    SET slug = public.generate_mentor_slug(r.full_name, r.user_id)
    WHERE user_id = r.user_id;
  END LOOP;
END $$;
