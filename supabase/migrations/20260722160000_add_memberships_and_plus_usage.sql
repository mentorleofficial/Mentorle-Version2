-- Per-user Plus membership state + the "2 free sessions/month" consumption ledger.
-- Quota is always MONTHLY (even for yearly plans), anchored to quota_anchor_day.

CREATE TABLE IF NOT EXISTS public.memberships (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id                  uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  status                   text NOT NULL CHECK (status IN ('pending','active','past_due','cancelled','expired')),
  cashfree_subscription_id text,
  started_at               timestamptz,
  current_period_start     timestamptz,   -- billing window
  current_period_end       timestamptz,
  quota_anchor_day         integer CHECK (quota_anchor_day BETWEEN 1 AND 31),  -- day-of-month the monthly quota resets
  auto_renew               boolean NOT NULL DEFAULT true,
  cancel_at_period_end     boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- No plan stacking: at most one non-terminal membership per user.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_membership_per_user
  ON public.memberships(user_id)
  WHERE status IN ('pending','active','past_due');

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_cf_sub ON public.memberships(cashfree_subscription_id);

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own membership" ON public.memberships;

CREATE POLICY "Users read own membership"
  ON public.memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.memberships TO authenticated;

-- ── plus_session_usage — one row per free Plus consumption ───────────────────
CREATE TABLE IF NOT EXISTS public.plus_session_usage (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id      uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,   -- denormalized for RLS
  kind               text NOT NULL CHECK (kind IN ('session','event')),
  reference_id       uuid NOT NULL,        -- session id / event participant id
  mentor_id          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  list_price         numeric(10,2) NOT NULL,   -- snapshot at consumption
  accrued_amount     numeric(10,2) NOT NULL,   -- plus_payout_percent * list_price at consumption
  quota_period_start date NOT NULL,
  quota_period_end   date NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plus_usage_membership_period
  ON public.plus_session_usage(membership_id, quota_period_start);
CREATE INDEX IF NOT EXISTS idx_plus_usage_mentor ON public.plus_session_usage(mentor_id);

ALTER TABLE public.plus_session_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members and mentors read plus usage" ON public.plus_session_usage;

CREATE POLICY "Members and mentors read plus usage"
  ON public.plus_session_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR mentor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.plus_session_usage TO authenticated;
