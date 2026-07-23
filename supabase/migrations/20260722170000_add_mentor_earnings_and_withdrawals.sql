-- Mentor earnings ledger, payout address, and manual withdrawal requests.
-- Financial-audit tables keep mentor_id ON DELETE SET NULL so history survives a user deletion.

-- ── mentor_payout_accounts (sensitive) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mentor_payout_accounts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id  uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  method     text NOT NULL CHECK (method IN ('upi','bank')),
  details    jsonb NOT NULL,   -- {upi_id} | {account_no, ifsc, holder_name}
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mentor_payout_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mentors manage own payout account" ON public.mentor_payout_accounts;
DROP POLICY IF EXISTS "Admins read payout accounts" ON public.mentor_payout_accounts;

CREATE POLICY "Mentors manage own payout account"
  ON public.mentor_payout_accounts FOR ALL TO authenticated
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid());

CREATE POLICY "Admins read payout accounts"
  ON public.mentor_payout_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_payout_accounts TO authenticated;

-- ── withdrawal_requests ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id               uuid REFERENCES public.users(id) ON DELETE SET NULL,
  amount                  numeric(10,2) NOT NULL CHECK (amount > 0),
  status                  text NOT NULL DEFAULT 'requested'
                            CHECK (status IN ('requested','approved','paid','rejected')),
  payout_account_snapshot jsonb,          -- address captured at request time
  admin_note              text,
  payment_reference       text,           -- filled when the admin marks it paid
  requested_at            timestamptz NOT NULL DEFAULT now(),
  processed_at            timestamptz,
  processed_by            uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_mentor ON public.withdrawal_requests(mentor_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawal_requests(status);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mentors read own withdrawals" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Mentors create own withdrawals" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Admins update withdrawals" ON public.withdrawal_requests;

CREATE POLICY "Mentors read own withdrawals"
  ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (mentor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- A mentor may only open a request for themselves, in the 'requested' state.
-- Amount-vs-balance validation is enforced server-side by the withdrawal flow (added with its UI).
CREATE POLICY "Mentors create own withdrawals"
  ON public.withdrawal_requests FOR INSERT TO authenticated
  WITH CHECK (mentor_id = auth.uid() AND status = 'requested');

CREATE POLICY "Admins update withdrawals"
  ON public.withdrawal_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT, INSERT, UPDATE ON public.withdrawal_requests TO authenticated;

-- ── mentor_earnings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mentor_earnings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id             uuid REFERENCES public.users(id) ON DELETE SET NULL,
  source                text NOT NULL CHECK (source IN ('paid_session','plus_session','plus_event','adjustment')),
  reference_id          uuid,                 -- session / event / payment id
  gross_amount          numeric(10,2) NOT NULL,   -- what the booking was worth
  fee_amount            numeric(10,2) NOT NULL DEFAULT 0,  -- platform's cut
  net_amount            numeric(10,2) NOT NULL,   -- what the mentor earns
  currency              text NOT NULL DEFAULT 'INR',
  status                text NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued','withdrawn','reversed')),
  withdrawal_request_id uuid REFERENCES public.withdrawal_requests(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_earnings_mentor ON public.mentor_earnings(mentor_id);
CREATE INDEX IF NOT EXISTS idx_earnings_status ON public.mentor_earnings(status);

ALTER TABLE public.mentor_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mentors read own earnings" ON public.mentor_earnings;

CREATE POLICY "Mentors read own earnings"
  ON public.mentor_earnings FOR SELECT TO authenticated
  USING (mentor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.mentor_earnings TO authenticated;

-- ── Atomic Plus-quota consumption ────────────────────────────────────────────
-- The monthly quota window start, anchored to the member's reset day (clamped to month length).
CREATE OR REPLACE FUNCTION public.plus_quota_window_start(_anchor_day int, _today date)
RETURNS date
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  month_start date := date_trunc('month', _today)::date;
  month_len   int  := EXTRACT(DAY FROM (month_start + interval '1 month - 1 day'))::int;
  anchor      date := month_start + (LEAST(GREATEST(_anchor_day, 1), month_len) - 1);
BEGIN
  IF _today >= anchor THEN
    RETURN anchor;
  END IF;
  month_start := (month_start - interval '1 month')::date;
  month_len   := EXTRACT(DAY FROM (month_start + interval '1 month - 1 day'))::int;
  RETURN month_start + (LEAST(GREATEST(_anchor_day, 1), month_len) - 1);
END;
$$;

-- Records one free Plus consumption atomically: locks the membership row, re-checks the
-- monthly quota, then writes the usage ledger + mentor earning in a single transaction.
-- The row lock is what prevents two concurrent bookings from both passing the quota check.
-- Callable only by the service role (the book-plus-session edge function).
CREATE OR REPLACE FUNCTION public.consume_plus_session(
  _user_id      uuid,
  _kind         text,
  _mentor_id    uuid,
  _reference_id uuid,   -- already-created session / participant id
  _list_price   numeric
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _m         public.memberships%ROWTYPE;
  _quota     int;
  _win_start date;
  _win_end   date;
  _used      int;
  _percent   numeric;
  _accrued   numeric;
  _usage_id  uuid;
BEGIN
  SELECT * INTO _m FROM public.memberships
    WHERE user_id = _user_id AND status = 'active'
    ORDER BY current_period_end DESC NULLS LAST
    LIMIT 1
    FOR UPDATE;
  IF _m.id IS NULL THEN
    RAISE EXCEPTION 'NO_ACTIVE_MEMBERSHIP';
  END IF;

  SELECT monthly_quota INTO _quota FROM public.subscription_plans WHERE id = _m.plan_id;
  _quota := COALESCE(_quota, 2);

  _win_start := public.plus_quota_window_start(
    COALESCE(_m.quota_anchor_day, EXTRACT(DAY FROM COALESCE(_m.started_at, now()))::int),
    current_date
  );
  _win_end := (_win_start + interval '1 month')::date;

  SELECT count(*) INTO _used FROM public.plus_session_usage
    WHERE membership_id = _m.id AND quota_period_start = _win_start;
  IF _used >= _quota THEN
    RAISE EXCEPTION 'QUOTA_EXHAUSTED';
  END IF;

  SELECT plus_payout_percent INTO _percent FROM public.payment_settings LIMIT 1;
  _accrued := round(COALESCE(_list_price, 0) * COALESCE(_percent, 0) / 100, 2);

  INSERT INTO public.plus_session_usage(
    membership_id, user_id, kind, reference_id, mentor_id, list_price, accrued_amount,
    quota_period_start, quota_period_end)
  VALUES (_m.id, _user_id, _kind, _reference_id, _mentor_id, COALESCE(_list_price, 0), _accrued,
    _win_start, _win_end)
  RETURNING id INTO _usage_id;

  INSERT INTO public.mentor_earnings(mentor_id, source, reference_id, gross_amount, fee_amount, net_amount)
  VALUES (_mentor_id,
    CASE WHEN _kind = 'event' THEN 'plus_event' ELSE 'plus_session' END,
    _reference_id, COALESCE(_list_price, 0),
    GREATEST(COALESCE(_list_price, 0) - _accrued, 0), _accrued);

  RETURN _usage_id;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_plus_session(uuid, text, uuid, uuid, numeric) FROM anon, authenticated;
