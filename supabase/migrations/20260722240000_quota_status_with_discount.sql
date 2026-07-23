-- Add the Plus member discount to the quota-status RPC so the booking UI can display the
-- discounted price. Return type changes, so drop + recreate.

DROP FUNCTION IF EXISTS public.plus_quota_status();

CREATE FUNCTION public.plus_quota_status()
RETURNS TABLE (
  has_membership boolean,
  quota_total integer,
  quota_used integer,
  quota_remaining integer,
  discount_percent numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _m         public.memberships%ROWTYPE;
  _quota     integer;
  _win_start date;
  _used      integer;
  _discount  numeric;
BEGIN
  SELECT plus_discount_percent INTO _discount FROM public.payment_settings LIMIT 1;
  _discount := COALESCE(_discount, 0);

  SELECT * INTO _m FROM public.memberships
    WHERE user_id = auth.uid() AND status = 'active'
    ORDER BY current_period_end DESC NULLS LAST
    LIMIT 1;
  IF _m.id IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 0, _discount;
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

  RETURN QUERY SELECT true, _quota, _used, GREATEST(_quota - _used, 0), _discount;
END;
$$;

GRANT EXECUTE ON FUNCTION public.plus_quota_status() TO authenticated;
