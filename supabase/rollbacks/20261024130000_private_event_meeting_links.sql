-- Undo 20261024130000. WARNING: puts every meeting link back into the publicly readable events_programs.
DROP TRIGGER IF EXISTS stash_event_meeting_links ON public.events_programs;
DROP FUNCTION IF EXISTS public.stash_event_meeting_links();
DROP FUNCTION IF EXISTS public.get_event_meeting_links(uuid[]);

UPDATE public.events_programs e
SET meeting_link = l.meeting_link,
    sessions = CASE
      WHEN jsonb_typeof(e.sessions) = 'array' THEN (
        SELECT coalesce(jsonb_agg(
          CASE WHEN jsonb_typeof(s) = 'object' AND l.session_links ? (s->>'id')
            THEN s || jsonb_build_object('meeting_link', l.session_links->>(s->>'id'))
            ELSE s END
        ), '[]'::jsonb)
        FROM jsonb_array_elements(e.sessions) s
      )
      ELSE e.sessions
    END
FROM public.event_meeting_links l
WHERE l.event_id = e.id;

DROP TABLE IF EXISTS public.event_meeting_links;
