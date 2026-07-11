
CREATE OR REPLACE FUNCTION public.prevent_double_reschedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.rescheduled_from_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.sessions
      WHERE rescheduled_from_id = NEW.rescheduled_from_id
        AND id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'This session has already been rescheduled once.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_double_reschedule ON public.sessions;
CREATE TRIGGER trg_prevent_double_reschedule
BEFORE INSERT ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_double_reschedule();
