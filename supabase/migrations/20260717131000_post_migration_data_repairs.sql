-- The mentorle.in import ran with session_replication_role=replica (triggers bypassed),
-- and the backfill missed pieces; these repairs make imported rows behave like native ones.

-- 1) Legacy FK (no ON DELETE action) blocked auth.admin.deleteUser for any user who
--    created an events_programs row.
DO $$
BEGIN
  IF to_regclass('public.events_programs') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_programs_created_by_fkey'
      AND conrelid = 'public.events_programs'::regclass
  ) THEN
    ALTER TABLE public.events_programs DROP CONSTRAINT events_programs_created_by_fkey;
  END IF;
  ALTER TABLE public.events_programs ALTER COLUMN created_by DROP NOT NULL;
  ALTER TABLE public.events_programs
    ADD CONSTRAINT events_programs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
END $$;

-- 2) Confirmed auth users skipped by the users backfill: recreate what handle_new_user
--    would have made, inferring role from legacy membership when available.
DO $$
BEGIN
  IF to_regclass('public.mentor_data') IS NOT NULL THEN
    INSERT INTO public.users (id, email, full_name, role)
    SELECT
      au.id,
      au.email,
      COALESCE(NULLIF(au.raw_user_meta_data->>'full_name',''), md.name, mdd.name, ''),
      COALESCE(
        (au.raw_user_meta_data->>'role')::app_role,
        CASE
          WHEN ad.user_id IS NOT NULL THEN 'admin'::app_role
          WHEN md.user_id IS NOT NULL THEN 'mentor'::app_role
          ELSE 'mentee'::app_role
        END
      )
    FROM auth.users au
    LEFT JOIN public.users pu ON pu.id = au.id
    LEFT JOIN public.mentor_data md ON md.user_id = au.id
    LEFT JOIN public.mentee_data mdd ON mdd.user_id = au.id
    LEFT JOIN public.admin_data ad ON ad.user_id = au.id
    WHERE pu.id IS NULL AND au.email_confirmed_at IS NOT NULL
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO public.users (id, email, full_name, role)
    SELECT
      au.id,
      au.email,
      COALESCE(NULLIF(au.raw_user_meta_data->>'full_name',''), ''),
      COALESCE((au.raw_user_meta_data->>'role')::app_role, 'mentee'::app_role)
    FROM auth.users au
    LEFT JOIN public.users pu ON pu.id = au.id
    WHERE pu.id IS NULL AND au.email_confirmed_at IS NOT NULL
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, u.role
FROM public.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = u.role
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Imported mentees predate the onboarding wizard; NULL onboarded_at forced every one
--    of them back through it. Profiles already carrying onboarding data count as complete.
UPDATE public.mentee_profiles
SET onboarded_at = created_at
WHERE onboarded_at IS NULL
  AND (COALESCE(goals,'') <> ''
       OR COALESCE(array_length(interests,1),0) > 0
       OR COALESCE(bio,'') <> '');

-- 4) Imported mentors have no slug, so public profile deep links 404.
--    Row-by-row so generate_mentor_slug sees previously assigned slugs (name collisions).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT mp.user_id, u.full_name
    FROM public.mentor_profiles mp
    JOIN public.users u ON u.id = mp.user_id
    WHERE mp.slug IS NULL OR mp.slug = ''
  LOOP
    UPDATE public.mentor_profiles
    SET slug = public.generate_mentor_slug(r.full_name, r.user_id)
    WHERE user_id = r.user_id;
  END LOOP;
END $$;

-- 5) Imported active mentors were approved long ago on mentorle.in; suppress the
--    first-login approval celebration for them.
UPDATE public.mentor_profiles
SET approval_acknowledged_at = now()
WHERE approval_acknowledged_at IS NULL AND is_active = true;
