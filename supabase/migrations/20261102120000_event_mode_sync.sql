-- Event mode: phones in step with the projector.
--
-- * While the presenter screen is open (it pings every 15s), event_live_feed says 'presenting' and phones check every
--   second through mentorle.in's /api/live (cached by Vercel for 1s, so thousands of phones cost Supabase about one
--   request a second). A spin then reaches every phone within ~2s, so the lead-in before the 12-second countdown
--   drops from 6s to 2.5s.
-- * my_event_draw_result gives a phone its own outcome during the countdown, so it can reveal at exactly the same
--   moment as the projector without asking anything at the reveal.

ALTER TABLE public.event_modes ADD COLUMN IF NOT EXISTS presenter_seen_at timestamptz;

CREATE OR REPLACE FUNCTION public.event_presenter_ping(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can open the presenter screen' USING ERRCODE = '42501';
  END IF;
  UPDATE public.event_modes SET presenter_seen_at = now() WHERE id = _event_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.event_presenter_ping(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.event_presenter_ping(uuid) TO authenticated;

-- 2.5 seconds between Spin and the start of the countdown (was 6).
DROP FUNCTION IF EXISTS public.event_draw_lead_seconds();
CREATE FUNCTION public.event_draw_lead_seconds() RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT 2.5 $$;

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
      'active', ev.ended_at IS NULL AND (ev.ends_at IS NULL OR ev.ends_at > now()),
      -- The presenter screen is open: phones switch to fast checks so a spin reaches them within a second or two.
      'presenting', coalesce(ev.presenter_seen_at > now() - interval '45 seconds', false)
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
    -- During the countdown each phone already gets its own outcome (never anyone else's), so it can show it at
    -- exactly the reveal moment with no request then. Only the viewer's own win/lose, a few seconds early.
    RETURN jsonb_build_object('status', 'pending', 'entered', entered, 'draw_id', d.id,
      'reveal_in_ms', round(extract(epoch FROM (d.reveal_at - now())) * 1000)::bigint,
      'outcome', CASE
        WHEN auth.uid() IS NOT NULL AND d.winner_user_id = auth.uid() THEN 'won'
        WHEN auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.event_entries WHERE event_mode_id = ev.id AND user_id = auth.uid()) THEN 'lost'
        ELSE 'not_entered' END);
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

NOTIFY pgrst, 'reload schema';
