-- Ensure event_participants.user_id FK exists so PostgREST can embed users (idempotent).
DO $$
BEGIN
  IF to_regclass('public.event_participants') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'event_participants_user_id_fkey'
         AND conrelid = 'public.event_participants'::regclass
     ) THEN
    ALTER TABLE public.event_participants
      ADD CONSTRAINT event_participants_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- List event participants with user details for admins and event creators.
CREATE OR REPLACE FUNCTION public.get_event_participants(_event_id uuid)
RETURNS TABLE (
  id uuid,
  registered_at timestamptz,
  full_name text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ep.id, ep.registered_at, u.full_name, u.email
  FROM public.event_participants ep
  JOIN public.users u ON u.id = ep.user_id
  WHERE ep.event_id = _event_id
    AND (
      ep.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.events_programs e
        WHERE e.id = _event_id AND e.created_by = auth.uid()
      )
    )
  ORDER BY ep.registered_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_participants(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_event_participants(uuid) FROM anon, public;
