-- Paid events: add price + Plus fields to events_programs (the table the events feature
-- actually uses). price = 0 keeps the existing free-RSVP behaviour; > 0 requires payment.
-- plus_eligible lets Plus members register free (consuming a monthly session); plus_price is
-- the value used to compute the mentor's payout for that. (The stray plus_eligible/plus_price
-- on the unused `events` table from an earlier migration are left as vestigial.)

ALTER TABLE public.events_programs
  ADD COLUMN IF NOT EXISTS price numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plus_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plus_price numeric(10,2) NOT NULL DEFAULT 0;
