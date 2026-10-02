-- Undo 20261001130000: clear only the titles this migration filled in, and only if the
-- mentor has not edited the title since.
UPDATE public.mentor_profiles mp
SET "current_role" = ''
FROM legacy_archive.job_title_copy_20261001 c
WHERE mp.user_id = c.user_id
  AND mp."current_role" = c.copied_title;
