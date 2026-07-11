CREATE OR REPLACE FUNCTION public.list_public_offerings()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  duration_minutes int,
  price numeric,
  category text,
  status text,
  mentor_id uuid,
  mentor_full_name text,
  mentor_avatar_url text,
  mentor_current_role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.title,
    o.description,
    o.duration_minutes,
    o.price,
    o.category,
    o.status,
    o.mentor_id,
    u.full_name,
    u.avatar_url,
    mp."current_role"
  FROM public.mentorship_offerings o
  JOIN public.users u ON u.id = o.mentor_id
  LEFT JOIN public.mentor_profiles mp ON mp.user_id = o.mentor_id
  WHERE o.status = 'active'
    AND COALESCE(u.is_disabled, false) = false
    AND COALESCE(mp.is_active, true) = true
  ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_public_offerings() TO authenticated, anon;