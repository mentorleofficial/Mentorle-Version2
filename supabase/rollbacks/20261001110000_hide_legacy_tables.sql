-- Undo 20261001110000: move the legacy tables back to public. Only valid during the
-- observation window, before 20261004 drops the legacy_archive schema.
-- Grants are not restored on purpose: the anon/authenticated access they had was a leak.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_data', 'comment_likes', 'event_organizers', 'events', 'feedbacks', 'institutions',
    'mentee_data', 'mentor_data', 'mentor_payouts', 'mentorship_bookings', 'old_feedback',
    'old_mentor_availability', 'old_user_roles', 'post_comments', 'post_likes', 'post_views',
    'posts', 'roles', 'user_subscriptions'
  ] LOOP
    IF to_regclass('legacy_archive.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE legacy_archive.%I SET SCHEMA public', t);
    END IF;
  END LOOP;
END $$;
