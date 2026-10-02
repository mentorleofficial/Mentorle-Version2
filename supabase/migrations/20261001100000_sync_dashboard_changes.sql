-- These two columns were added to the live database through the dashboard and never
-- recorded in a migration. IF NOT EXISTS makes this a no-op on production.
ALTER TABLE public.mentor_profiles
  ADD COLUMN IF NOT EXISTS company_url text,
  ADD COLUMN IF NOT EXISTS designation text;

-- 20260820130000 was applied by hand without this grant, so the admin "activate mentor"
-- flow (src/features/admin/api/users.ts) silently failed to generate a slug.
GRANT EXECUTE ON FUNCTION public.generate_mentor_slug(text, uuid) TO authenticated;
