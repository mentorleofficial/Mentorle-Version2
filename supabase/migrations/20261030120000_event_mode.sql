-- Event mode: OTP-free quick signup for a live event, a public live-signups page on mentorle.in and a lucky draw.
--
--   event_modes      one row per event; "on" while ended_at is null (and ends_at, if set, hasn't passed). One at a time.
--   event_entries    every new mentee account confirmed while an event is on (trigger on public.users), one per person
--                    and one per phone number. Entries made before the first draw are the ones in the draw.
--   event_draws      each spin: the winner, how many were eligible, who drew, and reveal_at (when the result may be shown).
--
-- The winner is picked here, uniformly at random (gen_random_uuid() uses the server's secure random source), and saved
-- before anything animates; the admin's wheel and the public countdown both end at reveal_at, and nothing public says
-- who won before then. Quick signup itself is the event-quick-signup edge function, which refuses unless an event is on.

CREATE TABLE IF NOT EXISTS public.event_modes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  started_at        timestamptz NOT NULL DEFAULT now(),
  ends_at           timestamptz,               -- optional automatic end
  ended_at          timestamptz,               -- set when an admin ends it
  entries_closed_at timestamptz,               -- set by the first draw: later signups aren't in the draw
  started_by        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ended_by          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_mode_running ON public.event_modes ((true)) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS public.event_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_mode_id    uuid NOT NULL REFERENCES public.event_modes(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  full_name        text NOT NULL DEFAULT '',
  email            text NOT NULL DEFAULT '',
  phone            text,
  phone_normalized text,                       -- last 10 digits
  quick_signup     boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  disqualified_at  timestamptz,
  disqualified_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (event_mode_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_entry_phone ON public.event_entries (event_mode_id, phone_normalized) WHERE phone_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_entries_event ON public.event_entries (event_mode_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.event_draws (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_mode_id   uuid NOT NULL REFERENCES public.event_modes(id) ON DELETE CASCADE,
  winner_entry_id uuid REFERENCES public.event_entries(id) ON DELETE SET NULL,
  winner_user_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  eligible_count  integer NOT NULL,
  drawn_by        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  drawn_at        timestamptz NOT NULL DEFAULT now(),
  reveal_at       timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_draws_event ON public.event_draws (event_mode_id, drawn_at DESC);

-- Quick-signup attempts, for the edge function's rate limit (hashed IPs only).
CREATE TABLE IF NOT EXISTS public.event_signup_attempts (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_hash    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_signup_attempts ON public.event_signup_attempts (ip_hash, created_at DESC);

-- Admins read everything; changes only go through the functions below. Nobody else reads these tables directly.
ALTER TABLE public.event_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_signup_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_modes, public.event_entries, public.event_draws, public.event_signup_attempts FROM anon, authenticated;
GRANT SELECT ON public.event_modes, public.event_entries, public.event_draws TO authenticated;
DROP POLICY IF EXISTS "Admins read event modes" ON public.event_modes;
CREATE POLICY "Admins read event modes" ON public.event_modes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins read event entries" ON public.event_entries;
CREATE POLICY "Admins read event entries" ON public.event_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins read event draws" ON public.event_draws;
CREATE POLICY "Admins read event draws" ON public.event_draws FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- How long the wheel spins / the public countdown runs before the result may be shown.
CREATE OR REPLACE FUNCTION public.event_draw_reveal_seconds() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 12 $$;

-- The event that's on right now, if any.
CREATE OR REPLACE FUNCTION public.running_event_mode()
RETURNS public.event_modes
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.event_modes WHERE ended_at IS NULL AND (ends_at IS NULL OR ends_at > now()) LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.running_event_mode() FROM public, anon, authenticated;

-- --- Entries: every new mentee confirmed while an event is on ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.enter_event_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.event_modes;
  meta jsonb;
  ph text;
BEGIN
  IF NEW.role <> 'mentee' THEN
    RETURN NEW;
  END IF;
  ev := public.running_event_mode();
  IF ev.id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id = NEW.id;
  ph := nullif(trim(coalesce(meta->>'phone', '')), '');
  INSERT INTO public.event_entries (event_mode_id, user_id, full_name, email, phone, phone_normalized, quick_signup)
  VALUES (ev.id, NEW.id, coalesce(nullif(trim(NEW.full_name), ''), split_part(NEW.email, '@', 1)), NEW.email, ph,
          nullif(right(regexp_replace(coalesce(ph, ''), '\D', '', 'g'), 10), ''),
          coalesce(meta->>'event_mode_id', '') = ev.id::text)
  ON CONFLICT DO NOTHING; -- same person or same phone: counted once
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- never block a signup over the draw
END;
$$;
DROP TRIGGER IF EXISTS trg_enter_event_on_signup ON public.users;
CREATE TRIGGER trg_enter_event_on_signup AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.enter_event_on_signup();

-- --- Admin controls -----------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_mode_start(_name text, _ends_at timestamptz DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can start event mode' USING ERRCODE = '42501';
  END IF;
  IF _ends_at IS NOT NULL AND _ends_at <= now() THEN
    RAISE EXCEPTION 'The end time has to be in the future';
  END IF;
  -- An event whose automatic end has passed is closed first.
  UPDATE public.event_modes SET ended_at = ends_at WHERE ended_at IS NULL AND ends_at IS NOT NULL AND ends_at <= now();
  IF EXISTS (SELECT 1 FROM public.event_modes WHERE ended_at IS NULL) THEN
    RAISE EXCEPTION 'An event is already on. End it first.';
  END IF;
  INSERT INTO public.event_modes (name, ends_at, started_by) VALUES (trim(_name), _ends_at, auth.uid()) RETURNING event_modes.id INTO id;
  RETURN id;
END;
$$;

CREATE OR REPLACE FUNCTION public.event_mode_end(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can end event mode' USING ERRCODE = '42501';
  END IF;
  UPDATE public.event_modes SET ended_at = least(now(), coalesce(ends_at, now())), ended_by = auth.uid()
   WHERE id = _event_id AND ended_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.event_entry_set_disqualified(_entry_id uuid, _disqualified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change entries' USING ERRCODE = '42501';
  END IF;
  UPDATE public.event_entries
     SET disqualified_at = CASE WHEN _disqualified THEN now() END,
         disqualified_by = CASE WHEN _disqualified THEN auth.uid() END
   WHERE id = _entry_id;
END;
$$;

-- Spin: pick one winner from the eligible entries (made before the first draw, not disqualified, not already drawn).
-- Returns the winner and the names on the wheel; the result is public only from reveal_at.
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
  VALUES (ev.id, winner.id, winner.user_id, total, auth.uid(), now() + make_interval(secs => public.event_draw_reveal_seconds()))
  RETURNING * INTO draw;

  RETURN jsonb_build_object(
    'draw_id', draw.id,
    'reveal_in', public.event_draw_reveal_seconds(),
    'eligible_count', total,
    'pool', pool,
    'winner', jsonb_build_object('entry_id', winner.id, 'user_id', winner.user_id, 'name', winner.full_name, 'email', winner.email, 'phone', winner.phone)
  );
END;
$$;

-- Delete an event that's over (test runs, old events): its entries and draws go with it. The accounts people
-- created stay; they're normal Mentorle accounts. A running event has to be turned off first.
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

-- Everything the admin page shows for one event: the event, every entry (with whether the profile is complete and
-- whether it's in the draw) and the draws with their winners.
CREATE OR REPLACE FUNCTION public.event_mode_detail(_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.event_modes;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can see event entries' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO ev FROM public.event_modes WHERE id = _event_id;
  IF ev.id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'event', to_jsonb(ev) || jsonb_build_object('active', ev.ended_at IS NULL AND (ev.ends_at IS NULL OR ev.ends_at > now())),
    'entries', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', e.id, 'user_id', e.user_id, 'full_name', e.full_name, 'email', e.email, 'phone', e.phone,
               'quick_signup', e.quick_signup, 'created_at', e.created_at, 'disqualified_at', e.disqualified_at,
               'onboarded', mp.onboarded_at IS NOT NULL,
               'in_draw', ev.entries_closed_at IS NULL OR e.created_at <= ev.entries_closed_at
             ) ORDER BY e.created_at DESC)
        FROM public.event_entries e
        LEFT JOIN public.mentee_profiles mp ON mp.user_id = e.user_id
       WHERE e.event_mode_id = ev.id), '[]'::jsonb),
    'draws', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', d.id, 'drawn_at', d.drawn_at, 'reveal_at', d.reveal_at, 'eligible_count', d.eligible_count,
               'winner', jsonb_build_object('entry_id', w.id, 'name', w.full_name, 'email', w.email, 'phone', w.phone),
               'drawn_by', u.full_name
             ) ORDER BY d.drawn_at)
        FROM public.event_draws d
        LEFT JOIN public.event_entries w ON w.id = d.winner_entry_id
        LEFT JOIN public.users u ON u.id = d.drawn_by
       WHERE d.event_mode_id = ev.id), '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.event_mode_start(text, timestamptz), public.event_mode_end(uuid), public.event_entry_set_disqualified(uuid, boolean), public.event_draw(uuid), public.event_mode_detail(uuid), public.event_mode_delete(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.event_mode_start(text, timestamptz), public.event_mode_end(uuid), public.event_entry_set_disqualified(uuid, boolean), public.event_draw(uuid), public.event_mode_detail(uuid), public.event_mode_delete(uuid) TO authenticated;

-- --- Public: is quick signup on, and the live page ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_mode_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN ev.id IS NULL THEN jsonb_build_object('active', false)
              ELSE jsonb_build_object('active', true, 'name', ev.name) END
    FROM (SELECT (public.running_event_mode()).*) ev
$$;

-- The live page: the running event (or one that ended in the last 6 hours, so the result stays up) and the latest
-- draw's countdown. Attendees only see "the winner will be revealed soon", the countdown and their own result, so
-- this never returns names, counts, contact details or who won.
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

-- The signed-in viewer's own result for the latest draw, once it may be shown.
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

REVOKE EXECUTE ON FUNCTION public.event_mode_status(), public.event_live_feed(), public.my_event_draw_result() FROM public;
GRANT EXECUTE ON FUNCTION public.event_mode_status(), public.event_live_feed() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_event_draw_result() TO authenticated;
