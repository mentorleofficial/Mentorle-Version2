-- Realtime for notifications.
--
-- The platform's NotificationBell and mentorle.in's header bell subscribe to postgres_changes on
-- public.notifications, but the table was never added to the supabase_realtime publication, so no events were
-- sent and new notifications only appeared after a reload. Realtime still applies the table's RLS, so each
-- subscriber only receives their own rows ("Users can view their own notifications").
--
-- Rollback: supabase/rollbacks/20261027120000_notifications_realtime.sql

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$$;
