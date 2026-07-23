-- Drop the mentor-set plus_price on events: the Plus payout basis is the event's own price
-- (× admin plus_payout_percent), consistent with offerings/sessions. Nothing should let a
-- mentor set Plus-member economics — those are admin-controlled percentages.
ALTER TABLE public.events_programs DROP COLUMN IF EXISTS plus_price;
