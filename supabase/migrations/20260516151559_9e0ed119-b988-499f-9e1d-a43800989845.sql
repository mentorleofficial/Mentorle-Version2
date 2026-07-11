
-- 1) Mentor profiles: hide phone & resume_url from anonymous visitors
REVOKE SELECT (phone, resume_url) ON public.mentor_profiles FROM anon;

-- 2) Users table: stop signed-in users from listing every active mentor's email
DROP POLICY IF EXISTS "Authenticated read active mentor users" ON public.users;

-- 3) Prevent self role escalation / disabled flag tampering via users update
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins (acting on anyone) bypass these locks
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Non-admins editing their own row cannot change privileged columns
  IF auth.uid() = NEW.id THEN
    NEW.role         := OLD.role;
    NEW.is_disabled  := OLD.is_disabled;
    NEW.disabled_at  := OLD.disabled_at;
    NEW.disabled_by  := OLD.disabled_by;
    NEW.external_id  := OLD.external_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_privilege_change ON public.users;
CREATE TRIGGER trg_prevent_self_privilege_change
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_privilege_change();

-- 4) Tighten anonymous resume upload: require applications/<random-id>/<file>
DROP POLICY IF EXISTS "Anonymous can upload application resume" ON storage.objects;
CREATE POLICY "Anonymous can upload application resume"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'mentor-resumes'
  AND (storage.foldername(name))[1] = 'applications'
  AND array_length(storage.foldername(name), 1) = 2
  AND length((storage.foldername(name))[2]) >= 16
);

-- 5) Revoke EXECUTE on internal helpers from anon (keep public-facing ones available)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_program_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_program_mentor(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_mentee_book_mentor(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_mentor_slug(text, uuid) FROM anon;
