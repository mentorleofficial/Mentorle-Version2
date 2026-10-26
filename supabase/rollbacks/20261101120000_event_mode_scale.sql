-- Rollback for 20261101120000_event_mode_scale.sql: re-run the event_draw and event_live_feed definitions from
-- 20261031120000_event_mode_followup.sql / 20261030120000_event_mode.sql, then drop the lead-in helper.
DROP FUNCTION IF EXISTS public.event_draw_lead_seconds();
