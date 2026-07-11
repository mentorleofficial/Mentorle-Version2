-- RPC: get accurate mentor and mentee counts for a set of programs
-- Uses SECURITY DEFINER to bypass RLS (which restricts cross-member visibility).
-- Returns one row per program_id with the real counts.
CREATE OR REPLACE FUNCTION public.get_program_member_counts(program_ids uuid[])
RETURNS TABLE (
  program_id  uuid,
  mentor_count bigint,
  mentee_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS program_id,
    COUNT(DISTINCT pm.mentor_id) AS mentor_count,
    COUNT(DISTINCT pme.mentee_id) AS mentee_count
  FROM public.programs p
  LEFT JOIN public.program_mentors pm  ON pm.program_id  = p.id
  LEFT JOIN public.program_mentees pme ON pme.program_id = p.id
  WHERE p.id = ANY(program_ids)
  GROUP BY p.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_program_member_counts(uuid[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_program_member_counts(uuid[]) FROM anon, public;
