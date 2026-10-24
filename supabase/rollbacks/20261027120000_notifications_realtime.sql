-- Rollback for 20261027120000_notifications_realtime.sql: stop publishing notifications to realtime.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
  END IF;
END
$$;
