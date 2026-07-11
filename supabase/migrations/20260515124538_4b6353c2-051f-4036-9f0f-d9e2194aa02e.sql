
-- 1. Mentor profiles: drop overly broad authenticated read
DROP POLICY IF EXISTS "Authenticated users read mentor profiles" ON public.mentor_profiles;

-- Mentors can still read their own profile (whether active or not)
CREATE POLICY "Mentors read own profile"
  ON public.mentor_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2. Users: restrict the public-mentor exposure to authenticated only.
-- Anonymous visitors will use the safe view below instead.
DROP POLICY IF EXISTS "Public read active mentor users" ON public.users;
CREATE POLICY "Authenticated read active mentor users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    is_disabled = false
    AND EXISTS (
      SELECT 1 FROM public.mentor_profiles mp
      WHERE mp.user_id = users.id AND mp.is_active = true
    )
  );

-- Safe public view: only non-sensitive columns for active mentors (no email)
CREATE OR REPLACE VIEW public.public_mentor_users
WITH (security_invoker = false) AS
SELECT u.id, u.full_name, u.avatar_url
FROM public.users u
JOIN public.mentor_profiles mp ON mp.user_id = u.id
WHERE u.is_disabled = false AND mp.is_active = true;

GRANT SELECT ON public.public_mentor_users TO anon, authenticated;

-- 3. Storage: enforce path ownership for anonymous resume uploads
DROP POLICY IF EXISTS "Anonymous can upload application resume" ON storage.objects;
CREATE POLICY "Anonymous can upload application resume"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'mentor-resumes'
    AND (storage.foldername(name))[1] = 'applications'
    AND array_length(storage.foldername(name), 1) = 1
  );

-- Allow admins (and applicants via existing policies) to read application uploads
-- (Admins read resumes policy already covers this.)

-- 4. Branding bucket: restrict public read to known subfolders
DROP POLICY IF EXISTS "Branding assets public read" ON storage.objects;
CREATE POLICY "Branding assets public read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'branding-assets'
    AND (storage.foldername(name))[1] IN ('logo', 'bg', 'avatars', 'login-bg')
  );

-- 5. Mentor applications insert: minimal validation instead of always-true
DROP POLICY IF EXISTS "Anyone can submit application" ON public.mentor_applications;
CREATE POLICY "Anyone can submit application"
  ON public.mentor_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(btrim(email)) > 3
    AND length(btrim(full_name)) > 0
    AND status = 'pending'
  );

-- 6. Revoke EXECUTE on SECURITY DEFINER helpers from public roles.
-- They remain callable from within RLS policies (which run as the policy owner).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_program_member(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_program_mentor(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_mentee_book_mentor(uuid, uuid) FROM anon, authenticated, public;

-- 7. Pin search_path on common utility/trigger functions if present
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public',
                   r.schema, r.name, r.args);
  END LOOP;
END $$;
