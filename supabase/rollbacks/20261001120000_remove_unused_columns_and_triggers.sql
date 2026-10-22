-- Undo 20261001120000: restores structure only. Column data comes back from the
-- 2026-10-01 backup (db backup/2026-10-01/data.sql) if it is needed.
ALTER TABLE public.event_participants ADD COLUMN IF NOT EXISTS attendance_status text DEFAULT 'registered'::text;
ALTER TABLE public.event_participants ADD COLUMN IF NOT EXISTS feedback text;
ALTER TABLE public.event_participants ADD COLUMN IF NOT EXISTS rating integer;
ALTER TABLE public.event_participants ADD COLUMN IF NOT EXISTS feedback_date timestamp with time zone;
ALTER TABLE public.event_participants ADD CONSTRAINT event_participants_attendance_status_check
  CHECK (attendance_status = ANY (ARRAY['registered'::text, 'attended'::text, 'no_show'::text]));
ALTER TABLE public.event_participants ADD CONSTRAINT event_participants_rating_check
  CHECK (rating >= 1 AND rating <= 5);

ALTER TABLE public.events_programs ADD COLUMN IF NOT EXISTS college_id text;
ALTER TABLE public.events_programs ADD COLUMN IF NOT EXISTS current_participants integer DEFAULT 0;
ALTER TABLE public.events_programs ADD COLUMN IF NOT EXISTS syllabus jsonb;
ALTER TABLE public.events_programs ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE public.events_programs ADD COLUMN IF NOT EXISTS institution_id uuid;
CREATE INDEX IF NOT EXISTS idx_events_programs_college ON public.events_programs USING btree (college_name, college_id);
UPDATE public.events_programs SET current_participants = participant_count;

ALTER TABLE public.mentorship_offerings ADD COLUMN IF NOT EXISTS use_profile_availability boolean DEFAULT true NOT NULL;
ALTER TABLE public.mentorship_offerings ADD COLUMN IF NOT EXISTS custom_availability jsonb;
ALTER TABLE public.mentorship_offerings ADD COLUMN IF NOT EXISTS buffer_before_minutes integer DEFAULT 5;
ALTER TABLE public.mentorship_offerings ADD COLUMN IF NOT EXISTS buffer_after_minutes integer DEFAULT 5;
ALTER TABLE public.mentorship_offerings ADD COLUMN IF NOT EXISTS max_bookings_per_day integer DEFAULT 5;
ALTER TABLE public.mentorship_offerings ADD COLUMN IF NOT EXISTS advance_booking_days integer DEFAULT 30;
ALTER TABLE public.mentorship_offerings ADD COLUMN IF NOT EXISTS min_notice_hours integer DEFAULT 24;
ALTER TABLE public.mentorship_offerings ADD COLUMN IF NOT EXISTS cancellation_policy text;
ALTER TABLE public.mentorship_offerings ADD COLUMN IF NOT EXISTS preparation_notes text;
ALTER TABLE public.mentorship_offerings ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;
ALTER TABLE public.mentorship_offerings ADD COLUMN IF NOT EXISTS total_bookings integer DEFAULT 0;
ALTER TABLE public.mentorship_offerings ADD COLUMN IF NOT EXISTS total_completed integer DEFAULT 0;
ALTER TABLE public.mentorship_offerings ADD COLUMN IF NOT EXISTS average_rating numeric(3,2);

CREATE OR REPLACE FUNCTION public.update_participant_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE events_programs SET current_participants = current_participants + 1 WHERE id = NEW.event_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE events_programs SET current_participants = current_participants - 1 WHERE id = OLD.event_id;
    END IF;
    RETURN NULL;
END;
$function$;
CREATE TRIGGER update_event_participant_count AFTER INSERT OR DELETE ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_participant_count();
CREATE TRIGGER update_events_programs_updated_at BEFORE UPDATE ON public.events_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
