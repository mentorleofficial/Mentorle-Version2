-- Homepage featured mentors for mentorle.in: admins pick up to three mentors (Admin → Settings → Homepage).
--
-- A separate table, not a mentor_profiles column, because mentors can update their own profile row and could
-- otherwise feature themselves. Only admins write it; the public reads it through list_featured_mentors(),
-- which returns the same shape as list_public_mentors() and skips mentors who are inactive or disabled.

CREATE TABLE IF NOT EXISTS public.featured_mentors (
  position smallint PRIMARY KEY CHECK (position BETWEEN 1 AND 3),
  mentor_id uuid NOT NULL UNIQUE REFERENCES public.mentor_profiles(user_id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.featured_mentors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage featured mentors" ON public.featured_mentors;
CREATE POLICY "Admins manage featured mentors"
  ON public.featured_mentors
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

-- Public read, in slot order.
CREATE OR REPLACE FUNCTION public.list_featured_mentors()
RETURNS TABLE (
  "position" smallint,
  user_id uuid,
  slug text,
  full_name text,
  avatar_url text,
  headline text,
  bio text,
  expertise text[],
  years_experience integer,
  "current_role" text,
  current_organization text,
  domain text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.position, u.id, mp.slug, u.full_name, u.avatar_url,
         mp.headline, mp.bio, mp.expertise, mp.years_experience,
         mp.current_role, mp.current_organization, mp.domain
  FROM public.featured_mentors f
  JOIN public.mentor_profiles mp ON mp.user_id = f.mentor_id
  JOIN public.users u ON u.id = mp.user_id
  WHERE mp.is_active = true
    AND u.is_disabled = false
    AND mp.slug IS NOT NULL
  ORDER BY f.position;
$$;

REVOKE EXECUTE ON FUNCTION public.list_featured_mentors() FROM public;
GRANT EXECUTE ON FUNCTION public.list_featured_mentors() TO anon, authenticated;

-- Admin save: replaces all slots at once (array order = slot order; at most three distinct active mentors).
CREATE OR REPLACE FUNCTION public.set_featured_mentors(_mentor_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ids uuid[] := array_remove(coalesce(_mentor_ids, '{}'), NULL);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can change featured mentors' USING ERRCODE = '42501';
  END IF;
  IF cardinality(ids) > 3 THEN
    RAISE EXCEPTION 'At most three featured mentors';
  END IF;
  IF cardinality(ids) <> (SELECT count(DISTINCT x) FROM unnest(ids) x) THEN
    RAISE EXCEPTION 'A mentor can only be featured once';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(ids) x
    WHERE NOT EXISTS (SELECT 1 FROM public.mentor_profiles mp WHERE mp.user_id = x AND mp.is_active)
  ) THEN
    RAISE EXCEPTION 'Featured mentors must be active mentors';
  END IF;

  DELETE FROM public.featured_mentors WHERE true;
  INSERT INTO public.featured_mentors (position, mentor_id, updated_by)
  SELECT ord::smallint, id, auth.uid()
  FROM unnest(ids) WITH ORDINALITY AS t(id, ord);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_featured_mentors(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_featured_mentors(uuid[]) TO authenticated;
