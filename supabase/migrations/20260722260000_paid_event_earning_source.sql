-- Paid events: allow 'paid_event' as a mentor_earnings source (paid event registrations).
ALTER TABLE public.mentor_earnings DROP CONSTRAINT IF EXISTS mentor_earnings_source_check;
ALTER TABLE public.mentor_earnings ADD CONSTRAINT mentor_earnings_source_check
  CHECK (source IN ('paid_session', 'plus_session', 'plus_event', 'paid_event', 'adjustment'));
