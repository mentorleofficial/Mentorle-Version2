-- Mentors can flag an offering OR an event into the free Plus pool (any 2/month for members).

ALTER TABLE public.mentorship_offerings
  ADD COLUMN IF NOT EXISTS plus_eligible boolean NOT NULL DEFAULT false;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS plus_eligible boolean NOT NULL DEFAULT false;

-- Events carry no intrinsic price; plus_price is the notional value used to compute the
-- mentor's payout accrual when a Plus member consumes the event for free.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS plus_price numeric(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_offerings_plus_eligible
  ON public.mentorship_offerings(plus_eligible) WHERE plus_eligible;
CREATE INDEX IF NOT EXISTS idx_events_plus_eligible
  ON public.events(plus_eligible) WHERE plus_eligible;
