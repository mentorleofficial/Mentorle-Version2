-- Restore EXECUTE on RLS helper functions for authenticated users.
-- These are SECURITY DEFINER with pinned search_path; they are safe to call.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_program_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_program_mentor(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_mentee_book_mentor(uuid, uuid) TO authenticated;