-- Legacy tables imported from the old mentorle.in database. Nothing in the app or edge
-- functions reads or writes them. They move to a schema the API does not expose, so this
-- step is reversible (see supabase/rollbacks/20261001110000_hide_legacy_tables.sql).
-- Permanent deletion happens in a later migration after a 3-day observation window.
CREATE SCHEMA IF NOT EXISTS legacy_archive;
REVOKE ALL ON SCHEMA legacy_archive FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_data', 'comment_likes', 'event_organizers', 'events', 'feedbacks', 'institutions',
    'mentee_data', 'mentor_data', 'mentor_payouts', 'mentorship_bookings', 'old_feedback',
    'old_mentor_availability', 'old_user_roles', 'post_comments', 'post_likes', 'post_views',
    'posts', 'roles', 'user_subscriptions'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA legacy_archive', t);
      EXECUTE format('REVOKE ALL ON TABLE legacy_archive.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;
