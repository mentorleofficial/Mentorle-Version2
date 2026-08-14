-- Enforce program form rules at the database level.
-- The admin create/edit dialogs already validate these client-side; these
-- constraints stop the same bad values arriving through the API directly.
--
-- Guarded with IF NOT EXISTS because these were first applied by hand in the
-- Supabase SQL editor — re-running migrations against that database must not fail.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'programs_capacity_positive'
      AND conrelid = 'public.programs'::regclass
  ) THEN
    ALTER TABLE public.programs
      ADD CONSTRAINT programs_capacity_positive
      CHECK (capacity IS NULL OR capacity >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'programs_dates_ordered'
      AND conrelid = 'public.programs'::regclass
  ) THEN
    ALTER TABLE public.programs
      ADD CONSTRAINT programs_dates_ordered
      CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on > starts_on);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'programs_name_not_blank'
      AND conrelid = 'public.programs'::regclass
  ) THEN
    ALTER TABLE public.programs
      ADD CONSTRAINT programs_name_not_blank
      CHECK (btrim(name) <> '');
  END IF;
END $$;
