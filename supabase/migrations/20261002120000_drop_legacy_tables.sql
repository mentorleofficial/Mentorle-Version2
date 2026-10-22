-- Permanent removal of the legacy mentorle.in tables hidden by 20261001110000. Applied early
-- (instead of after the planned 3-day window) at the owner's request, after a full local
-- rehearsal and live read-only checks. A copy of every table is in db backup/2026-10-01/legacy_tables.sql.
DROP SCHEMA IF EXISTS legacy_archive CASCADE;

-- Leftover functions from the old site. No CASCADE: if anything still depends on one,
-- this fails instead of silently removing the dependent object.
DROP FUNCTION IF EXISTS public.blog_articles_search_vector_trigger();
DROP FUNCTION IF EXISTS public.check_duplicate_feedback();
DROP FUNCTION IF EXISTS public.compute_reading_time();
DROP FUNCTION IF EXISTS public.increment_post_view_count(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.payments_update_registrations_trigger();
DROP FUNCTION IF EXISTS public.update_mentor_rating_from_feedback();
DROP FUNCTION IF EXISTS public.update_offering_rating();
DROP FUNCTION IF EXISTS public.update_offering_stats();
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Enum types only the legacy tables used.
DROP TYPE IF EXISTS public.article_status;
DROP TYPE IF EXISTS public.event_status;
DROP TYPE IF EXISTS public.feedback_target_type;
DROP TYPE IF EXISTS public.outbound_event_status;
DROP TYPE IF EXISTS public.payment_status;
DROP TYPE IF EXISTS public.payout_status;
DROP TYPE IF EXISTS public.refund_status;
DROP TYPE IF EXISTS public.registration_status;
DROP TYPE IF EXISTS public.ticket_type;
