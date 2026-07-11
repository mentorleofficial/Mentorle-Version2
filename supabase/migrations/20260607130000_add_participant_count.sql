-- Add participant_count column to events_programs
ALTER TABLE public.events_programs 
  ADD COLUMN IF NOT EXISTS participant_count INTEGER NOT NULL DEFAULT 0;

-- Create function to update participant_count on event_participants insert/delete
CREATE OR REPLACE FUNCTION public.update_event_participant_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events_programs
    SET participant_count = participant_count + 1
    WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events_programs
    SET participant_count = GREATEST(0, participant_count - 1)
    WHERE id = OLD.event_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger on event_participants
DROP TRIGGER IF EXISTS update_event_participant_count_trg ON public.event_participants;
CREATE TRIGGER update_event_participant_count_trg
  AFTER INSERT OR DELETE ON public.event_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_event_participant_count();

-- Backfill existing counts
UPDATE public.events_programs ep
SET participant_count = (
  SELECT count(*)::integer 
  FROM public.event_participants ep_part
  WHERE ep_part.event_id = ep.id
);
