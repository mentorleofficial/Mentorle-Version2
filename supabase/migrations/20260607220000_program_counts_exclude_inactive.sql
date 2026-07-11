-- Update get_program_member_counts to also exclude mentors with is_active = false
CREATE OR REPLACE FUNCTION public.get_program_member_counts(program_ids uuid[])
RETURNS TABLE (
  program_id   uuid,
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
    COUNT(DISTINCT
      CASE WHEN u_m.is_disabled = false AND mp.is_active = true
           THEN pm.mentor_id END
    ) AS mentor_count,
    COUNT(DISTINCT
      CASE WHEN u_e.is_disabled = false
           THEN pme.mentee_id END
    ) AS mentee_count
  FROM public.programs p
  LEFT JOIN public.program_mentors pm   ON pm.program_id  = p.id
  LEFT JOIN public.users u_m            ON u_m.id         = pm.mentor_id
  LEFT JOIN public.mentor_profiles mp   ON mp.user_id     = pm.mentor_id
  LEFT JOIN public.program_mentees pme  ON pme.program_id = p.id
  LEFT JOIN public.users u_e            ON u_e.id         = pme.mentee_id
  WHERE p.id = ANY(program_ids)
  GROUP BY p.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_program_member_counts(uuid[]) TO authenticated;
