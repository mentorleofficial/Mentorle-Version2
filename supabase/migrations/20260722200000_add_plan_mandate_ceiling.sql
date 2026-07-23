-- Mandate ceiling: the max amount we're authorized to auto-debit for a subscription.
-- Setting it ABOVE the current price lets admins raise prices for active members later
-- (via a Cashfree amount update) without the member re-approving — up to this ceiling.
-- Raising beyond it requires a new mandate. NULL falls back to the plan price (exact-amount mandate).

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS max_amount numeric(10,2);

-- The ceiling actually authorized on each member's mandate (snapshot at subscribe time).
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS mandate_max_amount numeric(10,2);
