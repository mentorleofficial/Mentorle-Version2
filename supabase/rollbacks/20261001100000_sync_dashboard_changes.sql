-- Undo 20261001100000. The two columns already existed on production before it, so only
-- the grant is reverted.
REVOKE EXECUTE ON FUNCTION public.generate_mentor_slug(text, uuid) FROM authenticated;
