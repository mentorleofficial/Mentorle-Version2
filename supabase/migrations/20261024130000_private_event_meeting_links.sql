-- Security: event meeting links were readable by anyone.
--
-- events_programs is publicly readable ("Anyone can read events"), so its meeting_link column and the
-- meeting_link inside each `sessions` item went to every visitor with the public key, including the join
-- links of Plus-only and registration-only events.
--
-- Links now live in public.event_meeting_links, which nobody can read directly. They're returned by
-- get_event_meeting_links() only to the event's creator, admins and registered attendees.
--
-- Existing forms keep working unchanged: a trigger moves any meeting_link written to events_programs (and
-- to its sessions) into the private table and blanks the public copy. Writing "" clears a link; leaving it
-- null or out keeps the stored one, so a form that loaded the (blank) public value can't wipe it on save.

CREATE TABLE IF NOT EXISTS public.event_meeting_links (
  -- Deferred so the BEFORE INSERT trigger can store the link before the event row itself exists.
  event_id uuid PRIMARY KEY REFERENCES public.events_programs(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  meeting_link text,
  session_links jsonb NOT NULL DEFAULT '{}'::jsonb, -- { "<session id>": "<link>" }
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_meeting_links ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: reads go through get_event_meeting_links(), writes through the trigger below.
REVOKE ALL ON public.event_meeting_links FROM anon, authenticated;

-- Move existing links into the private table.
INSERT INTO public.event_meeting_links (event_id, meeting_link, session_links)
SELECT
  e.id,
  nullif(btrim(e.meeting_link), ''),
  coalesce((
    SELECT jsonb_object_agg(s->>'id', s->>'meeting_link')
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(e.sessions) = 'array' THEN e.sessions ELSE '[]'::jsonb END) s
    WHERE coalesce(s->>'id', '') <> '' AND coalesce(btrim(s->>'meeting_link'), '') <> ''
  ), '{}'::jsonb)
FROM public.events_programs e
WHERE coalesce(btrim(e.meeting_link), '') <> ''
   OR EXISTS (
     SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(e.sessions) = 'array' THEN e.sessions ELSE '[]'::jsonb END) s
     WHERE coalesce(btrim(s->>'meeting_link'), '') <> ''
   )
ON CONFLICT (event_id) DO NOTHING;

-- Keeps links out of events_programs from now on.
CREATE OR REPLACE FUNCTION public.stash_event_meeting_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_change text := NEW.meeting_link;          -- null = leave as is, '' = clear, otherwise set
  session_changes jsonb := '{}'::jsonb;           -- session id → link ('' = clear)
  cleaned_sessions jsonb := '[]'::jsonb;
  item jsonb;
BEGIN
  IF jsonb_typeof(NEW.sessions) = 'array' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.sessions) LOOP
      IF jsonb_typeof(item) = 'object' AND item ? 'meeting_link' THEN
        IF coalesce(item->>'id', '') <> '' AND item->>'meeting_link' IS NOT NULL THEN
          session_changes := session_changes || jsonb_build_object(item->>'id', btrim(item->>'meeting_link'));
        END IF;
        item := item - 'meeting_link';
      END IF;
      cleaned_sessions := cleaned_sessions || jsonb_build_array(item);
    END LOOP;
    NEW.sessions := cleaned_sessions;
  END IF;

  IF link_change IS NOT NULL OR session_changes <> '{}'::jsonb THEN
    INSERT INTO public.event_meeting_links AS l (event_id, meeting_link, session_links)
    VALUES (
      NEW.id,
      nullif(btrim(coalesce(link_change, '')), ''),
      jsonb_strip_nulls((SELECT coalesce(jsonb_object_agg(k, nullif(v, '')), '{}'::jsonb) FROM jsonb_each_text(session_changes) AS t(k, v)))
    )
    ON CONFLICT (event_id) DO UPDATE SET
      meeting_link = CASE WHEN link_change IS NULL THEN l.meeting_link ELSE nullif(btrim(link_change), '') END,
      session_links = jsonb_strip_nulls(
        l.session_links || (SELECT coalesce(jsonb_object_agg(k, to_jsonb(nullif(v, ''))), '{}'::jsonb) FROM jsonb_each_text(session_changes) AS t(k, v))
      ),
      updated_at = now();
  END IF;

  NEW.meeting_link := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stash_event_meeting_links ON public.events_programs;
CREATE TRIGGER stash_event_meeting_links
  BEFORE INSERT OR UPDATE ON public.events_programs
  FOR EACH ROW EXECUTE FUNCTION public.stash_event_meeting_links();

-- Blank the public copies (the trigger strips session links; the bare update is enough).
UPDATE public.events_programs
SET meeting_link = NULL, sessions = sessions
WHERE meeting_link IS NOT NULL
   OR (jsonb_typeof(sessions) = 'array' AND EXISTS (SELECT 1 FROM jsonb_array_elements(sessions) s WHERE jsonb_typeof(s) = 'object' AND s ? 'meeting_link'));

-- Links for the given events, only where the caller is an admin, the event's creator or registered.
CREATE OR REPLACE FUNCTION public.get_event_meeting_links(_event_ids uuid[])
RETURNS TABLE (event_id uuid, meeting_link text, session_links jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.event_id, l.meeting_link, l.session_links
  FROM public.event_meeting_links l
  JOIN public.events_programs e ON e.id = l.event_id
  WHERE l.event_id = ANY(_event_ids)
    AND auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR e.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.event_participants p WHERE p.event_id = e.id AND p.user_id = auth.uid())
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_event_meeting_links(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_event_meeting_links(uuid[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.stash_event_meeting_links() FROM public, anon, authenticated;
