-- Rollback for 20261030120000_event_mode.sql
DROP TRIGGER IF EXISTS trg_enter_event_on_signup ON public.users;
DROP FUNCTION IF EXISTS public.enter_event_on_signup();
DROP FUNCTION IF EXISTS public.my_event_draw_result();
DROP FUNCTION IF EXISTS public.event_live_feed();
DROP FUNCTION IF EXISTS public.event_mode_status();
DROP FUNCTION IF EXISTS public.event_mode_detail(uuid);
DROP FUNCTION IF EXISTS public.event_draw(uuid);
DROP FUNCTION IF EXISTS public.event_entry_set_disqualified(uuid, boolean);
DROP FUNCTION IF EXISTS public.event_mode_end(uuid);
DROP FUNCTION IF EXISTS public.event_mode_start(text, timestamptz);
DROP FUNCTION IF EXISTS public.running_event_mode();
DROP FUNCTION IF EXISTS public.event_draw_reveal_seconds();
DROP TABLE IF EXISTS public.event_signup_attempts;
DROP TABLE IF EXISTS public.event_draws;
DROP TABLE IF EXISTS public.event_entries;
DROP TABLE IF EXISTS public.event_modes;
