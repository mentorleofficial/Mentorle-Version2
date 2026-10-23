-- Security: self-signup could create an admin.
--
-- handle_new_user() copied `role` from raw_user_meta_data, which the signing-up browser controls
-- (supabase.auth.signUp({ options: { data: { role: "admin" } } }) with the public key), straight into
-- public.users and public.user_roles.
--
-- Now:
--   raw_app_meta_data->>'role'  — trusted. Only the service role can set app_metadata, so this is how
--                                  server-side tools assign any role (admin-manage-user passes it).
--   raw_user_meta_data->>'role' — browser-controlled. Only 'mentee' (default) and 'mentor'
--                                  (MentorApplicationForm; the account stays inactive until
--                                  approve-mentor-application) are honoured.
--   anything else (incl. 'admin' or an invalid value, which previously failed the cast) → 'mentee'.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trusted text := NEW.raw_app_meta_data->>'role';
  requested text := NEW.raw_user_meta_data->>'role';
  signup_role public.app_role;
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  signup_role := CASE
    WHEN trusted IN ('admin', 'mentor', 'mentee') THEN trusted::public.app_role
    WHEN requested IN ('mentee', 'mentor') THEN requested::public.app_role
    ELSE 'mentee'::public.app_role
  END;

  INSERT INTO public.users (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), signup_role)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, signup_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
