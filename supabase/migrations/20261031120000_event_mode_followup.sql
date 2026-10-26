-- Follow-up to 20261030120000_event_mode, for databases where that migration was applied before these last changes
-- (Supabase never re-runs an applied migration). Safe to run on any version of it:
--   * event_mode_delete: delete an event that's over (Admin → Event mode → Delete event).
--   * event_live_feed: the public /live feed no longer returns names or the signup count.
--   * my_event_draw_result: also says whether the viewer is in the draw ("You're in the draw" on /live).

CREATE OR REPLACE FUNCTION public.event_mode_delete(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.event_modes;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can delete events' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO ev FROM public.event_modes WHERE id = _event_id FOR UPDATE;
  IF ev.id IS NULL THEN
    RETURN;
  END IF;
  IF ev.ended_at IS NULL AND (ev.ends_at IS NULL OR ev.ends_at > now()) THEN
    RAISE EXCEPTION 'Turn event mode off before deleting this event';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_draws WHERE event_mode_id = ev.id AND reveal_at > now()) THEN
    RAISE EXCEPTION 'A draw is still in progress';
  END IF;
  DELETE FROM public.event_modes WHERE id = ev.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.event_mode_delete(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.event_mode_delete(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.event_live_feed()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.event_modes;
  d public.event_draws;
  draws integer;
BEGIN
  SELECT * INTO ev FROM public.event_modes
   WHERE (ended_at IS NULL AND (ends_at IS NULL OR ends_at > now())) OR coalesce(ended_at, ends_at) > now() - interval '6 hours'
   ORDER BY started_at DESC LIMIT 1;
  IF ev.id IS NULL THEN
    RETURN jsonb_build_object('event', NULL);
  END IF;
  SELECT * INTO d FROM public.event_draws WHERE event_mode_id = ev.id ORDER BY drawn_at DESC LIMIT 1;
  SELECT count(*) INTO draws FROM public.event_draws WHERE event_mode_id = ev.id;
  RETURN jsonb_build_object(
    'event', jsonb_build_object(
      'id', ev.id,
      'name', ev.name,
      'active', ev.ended_at IS NULL AND (ev.ends_at IS NULL OR ev.ends_at > now())
    ),
    'draw', CASE WHEN d.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', d.id,
      'number', draws,
      'reveal_in_ms', greatest(0, round(extract(epoch FROM (d.reveal_at - now())) * 1000))::bigint
    ) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.my_event_draw_result()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.event_modes;
  d public.event_draws;
  entered boolean := false;
BEGIN
  SELECT * INTO ev FROM public.event_modes
   WHERE (ended_at IS NULL AND (ends_at IS NULL OR ends_at > now())) OR coalesce(ended_at, ends_at) > now() - interval '6 hours'
   ORDER BY started_at DESC LIMIT 1;
  -- "You're in the draw": entered, not disqualified, and in before the list closed.
  IF auth.uid() IS NOT NULL AND ev.id IS NOT NULL THEN
    entered := EXISTS (SELECT 1 FROM public.event_entries
                        WHERE event_mode_id = ev.id AND user_id = auth.uid() AND disqualified_at IS NULL
                          AND (ev.entries_closed_at IS NULL OR created_at <= ev.entries_closed_at));
  END IF;
  SELECT * INTO d FROM public.event_draws WHERE event_mode_id = ev.id ORDER BY drawn_at DESC LIMIT 1;
  IF d.id IS NULL THEN
    RETURN jsonb_build_object('status', 'none', 'entered', entered);
  END IF;
  IF d.reveal_at > now() THEN
    RETURN jsonb_build_object('status', 'pending', 'entered', entered, 'draw_id', d.id, 'reveal_in_ms', round(extract(epoch FROM (d.reveal_at - now())) * 1000)::bigint);
  END IF;
  IF auth.uid() IS NOT NULL AND d.winner_user_id = auth.uid() THEN
    RETURN jsonb_build_object('status', 'won', 'entered', entered, 'draw_id', d.id);
  END IF;
  IF auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.event_entries WHERE event_mode_id = ev.id AND user_id = auth.uid()) THEN
    RETURN jsonb_build_object('status', 'lost', 'entered', entered, 'draw_id', d.id);
  END IF;
  RETURN jsonb_build_object('status', 'not_entered', 'entered', entered, 'draw_id', d.id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.event_live_feed(), public.my_event_draw_result() FROM public;
GRANT EXECUTE ON FUNCTION public.event_live_feed() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_event_draw_result() TO authenticated;

-- PostgREST picks up the new function straight away.
NOTIFY pgrst, 'reload schema';
