-- Old-site job titles were imported into the dashboard-only mentor_profiles.designation
-- column, which the app never reads, so those mentors show no title. Copy them into
-- "current_role" only where it is empty; existing values are never overwritten.
-- The affected rows are recorded so the rollback can clear exactly these.
CREATE TABLE IF NOT EXISTS legacy_archive.job_title_copy_20261001 (
  user_id uuid PRIMARY KEY,
  copied_title text NOT NULL
);

WITH filled AS (
  UPDATE public.mentor_profiles
  SET "current_role" = btrim(designation)
  WHERE coalesce(btrim("current_role"), '') = ''
    AND coalesce(btrim(designation), '') <> ''
  RETURNING user_id, "current_role"
)
INSERT INTO legacy_archive.job_title_copy_20261001 (user_id, copied_title)
SELECT user_id, "current_role" FROM filled
ON CONFLICT (user_id) DO NOTHING;
