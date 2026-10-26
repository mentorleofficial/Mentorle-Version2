-- Event mode at venue scale (thousands of phones on /live, thousands of names on the wheel).
--
-- Phones now check every ~5 seconds (instead of twice every 4), so a spin needs a moment to reach them all. The
-- draw's reveal is therefore set lead + countdown seconds ahead (6 + 12): every phone learns of the spin during the
-- lead-in, waits, and starts the same 12-second countdown at the same moment, ending together at the reveal. The
-- presenter's wheel spins for the whole 18 seconds. The countdown itself is unchanged.
-- event_live_feed also tells a signed-in viewer whether they're in the draw, so phones make one request per check.

CREATE OR REPLACE FUNCTION public.event_draw_lead_seconds() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 6 $$;

CREATE OR REPLACE FUNCTION public.event_draw(_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.event_modes;
  closed timestamptz;
  pool jsonb;
  total integer;
  winner public.event_entries;
  draw public.event_draws;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can draw' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO ev FROM public.event_modes WHERE id = _event_id FOR UPDATE;
  IF ev.id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_draws WHERE event_mode_id = ev.id AND reveal_at > now()) THEN
    RAISE EXCEPTION 'A draw is already in progress';
  END IF;
  closed := coalesce(ev.entries_closed_at, ev.ended_at, now());
  IF ev.entries_closed_at IS NULL THEN
    UPDATE public.event_modes SET entries_closed_at = closed WHERE id = ev.id;
  END IF;

  SELECT count(*), coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'name', e.full_name) ORDER BY e.created_at), '[]'::jsonb)
    INTO total, pool
    FROM public.event_entries e
   WHERE e.event_mode_id = ev.id AND e.created_at <= closed AND e.disqualified_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.event_draws d WHERE d.event_mode_id = ev.id AND d.winner_entry_id = e.id);
  IF total = 0 THEN
    RAISE EXCEPTION 'Nobody is left to draw';
  END IF;

  SELECT e.* INTO winner
    FROM public.event_entries e
   WHERE e.event_mode_id = ev.id AND e.created_at <= closed AND e.disqualified_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.event_draws d WHERE d.event_mode_id = ev.id AND d.winner_entry_id = e.id)
   ORDER BY gen_random_uuid()
   LIMIT 1;

  INSERT INTO public.event_draws (event_mode_id, winner_entry_id, winner_user_id, eligible_count, drawn_by, reveal_at)
  VALUES (ev.id, winner.id, winner.user_id, total, auth.uid(), now() + make_interval(secs => public.event_draw_lead_seconds() + public.event_draw_reveal_seconds()))
  RETURNING * INTO draw;

  RETURN jsonb_build_object(
    'draw_id', draw.id,
    'reveal_in', public.event_draw_lead_seconds() + public.event_draw_reveal_seconds(),
    'countdown', public.event_draw_reveal_seconds(),
    'eligible_count', total,
    'pool', pool,
    'winner', jsonb_build_object('entry_id', winner.id, 'user_id', winner.user_id, 'name', winner.full_name, 'email', winner.email, 'phone', winner.phone)
  );
END;
$$;

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
      'reveal_in_ms', greatest(0, round(extract(epoch FROM (d.reveal_at - now())) * 1000))::bigint,
      'countdown_ms', public.event_draw_reveal_seconds() * 1000
    ) END,
    -- The signed-in viewer: in the draw or not (one request per check instead of two).
    'me', CASE WHEN auth.uid() IS NULL THEN NULL ELSE jsonb_build_object('entered', EXISTS (
      SELECT 1 FROM public.event_entries
       WHERE event_mode_id = ev.id AND user_id = auth.uid() AND disqualified_at IS NULL
         AND (ev.entries_closed_at IS NULL OR created_at <= ev.entries_closed_at))) END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.event_draw(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.event_draw(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.event_live_feed() FROM public;
GRANT EXECUTE ON FUNCTION public.event_live_feed() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
