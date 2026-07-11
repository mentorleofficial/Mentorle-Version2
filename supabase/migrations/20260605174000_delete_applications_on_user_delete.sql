-- Trigger to delete associated mentor applications when a user is deleted
CREATE OR REPLACE FUNCTION public.handle_deleted_user_applications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.mentor_applications WHERE lower(email) = lower(OLD.email);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_applications_on_user_delete ON public.users;
CREATE TRIGGER trg_delete_applications_on_user_delete
  AFTER DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_user_applications();
