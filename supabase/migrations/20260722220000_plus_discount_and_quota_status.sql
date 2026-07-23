-- Plus member discount on paid items (admin-controlled) + a per-user quota-status RPC
-- the booking UI calls to show "N of M free sessions left this month".

ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS plus_discount_percent numeric(5,2) NOT NULL DEFAULT 0;

-- Returns the caller's Plus quota for the current monthly window.
CREATE OR REPLACE FUNCTION public.plus_quota_status()
RETURNS TABLE (has_membership boolean, quota_total integer, quota_used integer, quota_remaining integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _m         public.memberships%ROWTYPE;
  _quota     integer;
  _win_start date;
  _used      integer;
BEGIN
  SELECT * INTO _m FROM public.memberships
    WHERE user_id = auth.uid() AND status = 'active'
    ORDER BY current_period_end DESC NULLS LAST
    LIMIT 1;
  IF _m.id IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 0;
    RETURN;
  END IF;

  SELECT monthly_quota INTO _quota FROM public.subscription_plans WHERE id = _m.plan_id;
  _quota := COALESCE(_quota, 2);
  _win_start := public.plus_quota_window_start(
    COALESCE(_m.quota_anchor_day, EXTRACT(DAY FROM COALESCE(_m.started_at, now()))::int),
    current_date
  );
  SELECT count(*) INTO _used FROM public.plus_session_usage
    WHERE membership_id = _m.id AND quota_period_start = _win_start;

  RETURN QUERY SELECT true, _quota, _used, GREATEST(_quota - _used, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.plus_quota_status() TO authenticated;
