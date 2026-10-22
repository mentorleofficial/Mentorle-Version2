-- event_participants had two triggers keeping two participant counters on events_programs.
-- Keep update_event_participant_count_trg (participant_count); drop the legacy one that
-- maintained current_participants. Trigger must go before the column it writes to.
DROP TRIGGER IF EXISTS update_event_participant_count ON public.event_participants;
DROP FUNCTION IF EXISTS public.update_participant_count();

-- events_programs had two BEFORE UPDATE triggers both setting updated_at.
DROP TRIGGER IF EXISTS update_events_programs_updated_at ON public.events_programs;

-- Columns no code in src/ or supabase/functions reads or writes. Event and offering save
-- paths build explicit payloads, so none of them send these columns.
ALTER TABLE public.events_programs
  DROP COLUMN IF EXISTS current_participants,
  DROP COLUMN IF EXISTS college_id,
  DROP COLUMN IF EXISTS institution_id,
  DROP COLUMN IF EXISTS syllabus,
  DROP COLUMN IF EXISTS is_featured;

ALTER TABLE public.event_participants
  DROP COLUMN IF EXISTS feedback,
  DROP COLUMN IF EXISTS rating,
  DROP COLUMN IF EXISTS feedback_date,
  DROP COLUMN IF EXISTS attendance_status;

-- Legacy mentorle.in offering settings and counters. Buffer/notice settings the app uses
-- live on mentor_profiles; the counters were only maintained by triggers on the retired
-- mentorship_bookings table, so they were frozen.
ALTER TABLE public.mentorship_offerings
  DROP COLUMN IF EXISTS use_profile_availability,
  DROP COLUMN IF EXISTS custom_availability,
  DROP COLUMN IF EXISTS buffer_before_minutes,
  DROP COLUMN IF EXISTS buffer_after_minutes,
  DROP COLUMN IF EXISTS max_bookings_per_day,
  DROP COLUMN IF EXISTS advance_booking_days,
  DROP COLUMN IF EXISTS min_notice_hours,
  DROP COLUMN IF EXISTS cancellation_policy,
  DROP COLUMN IF EXISTS preparation_notes,
  DROP COLUMN IF EXISTS featured,
  DROP COLUMN IF EXISTS total_bookings,
  DROP COLUMN IF EXISTS total_completed,
  DROP COLUMN IF EXISTS average_rating;
