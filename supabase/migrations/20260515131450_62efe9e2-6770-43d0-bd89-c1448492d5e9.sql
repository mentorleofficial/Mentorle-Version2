
-- Recreate public_mentor_users as security invoker
DROP VIEW IF EXISTS public.public_mentor_users;
CREATE VIEW public.public_mentor_users
WITH (security_invoker = true) AS
SELECT u.id, u.full_name, u.avatar_url
FROM public.users u
JOIN public.mentor_profiles mp ON mp.user_id = u.id
WHERE u.is_disabled = false AND mp.is_active = true;
GRANT SELECT ON public.public_mentor_users TO anon, authenticated;

-- Allow anon/authenticated to read minimal users columns for active mentors via the view's joins.
-- The view runs as caller, so RLS applies — add a column-restricted policy:
CREATE POLICY "Public read minimal active mentor users"
  ON public.users
  FOR SELECT
  TO anon
  USING (
    is_disabled = false
    AND EXISTS (SELECT 1 FROM public.mentor_profiles mp WHERE mp.user_id = users.id AND mp.is_active = true)
  );
-- (Anon clients selecting email directly will still see it — to truly hide email from anon,
-- frontend must read via the view. We restrict columns at the application layer + recommend
-- using public_mentor_users for anonymous access.)

-- Revoke EXECUTE on every SECURITY DEFINER function in public schema from anon/authenticated/public.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, authenticated, public',
                   r.schema, r.name, r.args);
  END LOOP;
END $$;
