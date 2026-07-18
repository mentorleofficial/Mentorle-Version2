-- Imported legacy mentorle.in tables arrived with GRANT ALL to anon/authenticated and RLS
-- disabled, exposing PII (emails, phones, bookings, payment records) to any visitor.
-- The app reads none of these (no src/ references); lock them down pending archival.
-- events_programs / event_participants / mentee_favorites are excluded: actively used, policy-protected.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'mentor_data','mentee_data','admin_data','mentorship_bookings','user_subscriptions',
    'old_user_roles','old_feedback','old_mentor_availability','roles','events','event_organizers',
    'posts','post_comments','post_likes','post_views','comment_likes','feedbacks','institutions',
    'mentor_payouts'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- Pause the session-reminder cron: it posts every minute to a malformed URL
-- (branding.supabase_api_url wrongly includes /rest/v1/) for a function that also
-- needs BREVO_API_KEY. Rescheduled with a fixed URL + auth once email is configured.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-session-reminders-job') THEN
    PERFORM cron.unschedule('send-session-reminders-job');
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;
