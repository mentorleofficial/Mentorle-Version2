-- Rollback for 20261102120000_event_mode_sync.sql: back to a 6-second lead-in, then re-run event_live_feed and
-- my_event_draw_result from 20261101120000_event_mode_scale.sql / 20261031120000_event_mode_followup.sql.
DROP FUNCTION IF EXISTS public.event_draw_lead_seconds();
CREATE FUNCTION public.event_draw_lead_seconds() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 6 $$;
DROP FUNCTION IF EXISTS public.event_presenter_ping(uuid);
ALTER TABLE public.event_modes DROP COLUMN IF EXISTS presenter_seen_at;
